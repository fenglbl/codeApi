const axios = require('axios');
const RequestLog = require('../models/RequestLog');
const env = require('../config/env');
const { decrypt } = require('./crypto.service');

function resolveUpstream(localApiKey) {
  const upstream = localApiKey.defaultUpstreamId;
  if (!upstream || !upstream.enabled) throw new Error('No enabled default upstream configured');
  return upstream;
}

function mapModel(localApiKey, inputModel) {
  if (!inputModel) return inputModel;
  const found = (localApiKey.modelMappings || []).find(x => x.localModel === inputModel);
  return found ? found.upstreamModel : inputModel;
}

function joinUrl(baseUrl, path) {
  const normalizedBase = String(baseUrl || '').replace(/\/+$/, '');
  const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;

  if (normalizedBase.endsWith('/v1') && normalizedPath.startsWith('/v1/')) {
    return `${normalizedBase}${normalizedPath.slice(3)}`;
  }

  return `${normalizedBase}${normalizedPath}`;
}

function extractErrorMessage(err) {
  const data = err?.response?.data;
  if (!data) return err?.message || 'unknown_error';

  if (typeof data === 'string') return data.slice(0, 1000);
  if (Buffer.isBuffer(data)) return data.toString('utf8').slice(0, 1000);
  if (data.error?.message) return String(data.error.message).slice(0, 1000);
  if (data.message) return String(data.message).slice(0, 1000);

  try {
    return JSON.stringify(data).slice(0, 1000);
  } catch (_) {
    return err?.message || 'unknown_error';
  }
}

function countMessageContentChars(content) {
  if (!content) return 0;
  if (typeof content === 'string') return content.length;
  if (Array.isArray(content)) {
    return content.reduce((sum, item) => {
      if (typeof item === 'string') return sum + item.length;
      if (item?.type === 'text') return sum + String(item.text || '').length;
      return sum;
    }, 0);
  }
  return 0;
}

function countEmbeddingInputChars(input) {
  if (!input) return 0;
  if (typeof input === 'string') return input.length;
  if (Array.isArray(input)) {
    return input.reduce((sum, item) => sum + (typeof item === 'string' ? item.length : 0), 0);
  }
  return 0;
}

function countInputChars(path, payload) {
  if (!payload || typeof payload !== 'object') return 0;
  if (path === '/v1/chat/completions') {
    return (payload.messages || []).reduce((sum, msg) => sum + countMessageContentChars(msg?.content), 0);
  }
  if (path === '/v1/embeddings') {
    return countEmbeddingInputChars(payload.input);
  }
  return 0;
}

function countOutputChars(path, data) {
  if (!data || typeof data !== 'object') return 0;
  if (path === '/v1/chat/completions') {
    return (data.choices || []).reduce((sum, choice) => {
      const message = choice?.message?.content;
      const text = choice?.text;
      if (typeof message === 'string') return sum + message.length;
      if (Array.isArray(message)) return sum + countMessageContentChars(message);
      if (typeof text === 'string') return sum + text.length;
      return sum;
    }, 0);
  }
  return 0;
}

function extractUsage(data) {
  const usage = data?.usage || {};
  const promptDetails = usage.prompt_tokens_details || {};
  return {
    promptTokens: Number(usage.prompt_tokens || usage.input_tokens || 0),
    completionTokens: Number(usage.completion_tokens || usage.output_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0),
    cacheReadTokens: Number(promptDetails.cached_tokens || usage.cache_read_input_tokens || 0),
    cacheWriteTokens: Number(promptDetails.cache_creation_tokens || usage.cache_creation_input_tokens || 0)
  };
}

async function writeRequestLog({ localApiKey, upstream, path, model, isStream = false, statusCode, durationMs, errorMessage = '', promptTokens = 0, completionTokens = 0, totalTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0, inputChars = 0, outputChars = 0 }) {
  return RequestLog.create({
    localKeyId: localApiKey._id,
    upstreamId: upstream._id,
    path,
    model: model || '',
    isStream,
    statusCode,
    durationMs,
    promptTokens,
    completionTokens,
    totalTokens,
    cacheReadTokens,
    cacheWriteTokens,
    inputChars,
    outputChars,
    errorMessage
  });
}

async function finalizeStreamLog(logId, patch) {
  if (!logId) return;
  await RequestLog.findByIdAndUpdate(logId, { $set: patch });
}

async function proxyOpenAiRequest({ localApiKey, path, method = 'POST', body = null, query = null, stream = false }) {
  const startedAt = Date.now();
  const upstream = resolveUpstream(localApiKey);
  const apiKey = decrypt(upstream.apiKeyEncrypted, upstream.apiKeyIv);
  const url = joinUrl(upstream.baseUrl, path);
  const payload = body && typeof body === 'object' ? { ...body } : body;

  if (payload && payload.model) payload.model = mapModel(localApiKey, payload.model);

  try {
    const response = await axios({
      url,
      method,
      params: query || undefined,
      data: payload || undefined,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: env.upstreamTimeoutMs,
      responseType: stream ? 'stream' : 'json'
    });

    const inputChars = countInputChars(path, payload);

    if (stream) {
      const log = await writeRequestLog({
        localApiKey,
        upstream,
        path,
        model: payload && payload.model ? payload.model : '',
        isStream: true,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputChars,
        outputChars: 0,
        errorMessage: ''
      });

      response.codeAipLogId = String(log._id);
      response.codeAipLogStartedAt = startedAt;
      return response;
    }

    const usage = extractUsage(response.data);
    const outputChars = countOutputChars(path, response.data);

    await writeRequestLog({
      localApiKey,
      upstream,
      path,
      model: payload && payload.model ? payload.model : '',
      isStream: false,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      inputChars,
      outputChars,
      errorMessage: ''
    });

    return response;
  } catch (err) {
    const statusCode = err.response?.status || 502;
    await writeRequestLog({
      localApiKey,
      upstream,
      path,
      model: payload && payload.model ? payload.model : '',
      isStream: stream,
      statusCode,
      durationMs: Date.now() - startedAt,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      inputChars: countInputChars(path, payload),
      outputChars: 0,
      errorMessage: extractErrorMessage(err)
    });
    throw err;
  }
}

module.exports = {
  proxyOpenAiRequest,
  mapModel,
  joinUrl,
  extractErrorMessage,
  writeRequestLog,
  finalizeStreamLog,
  extractUsage,
  countInputChars,
  countOutputChars
};
