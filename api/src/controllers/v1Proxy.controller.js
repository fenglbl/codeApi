const { proxyOpenAiRequest, finalizeStreamLog, extractErrorMessage } = require('../services/proxy.service');
const LocalApiKey = require('../models/LocalApiKey');

function buildSafeErrorBody(err) {
  const detail = err?.response?.data
  const message = extractErrorMessage(err)

  if (typeof detail === 'string') {
    return {
      message,
      detail: detail.slice(0, 4000)
    }
  }

  if (Buffer.isBuffer(detail)) {
    const text = detail.toString('utf8').slice(0, 4000)
    return {
      message,
      detail: text
    }
  }

  if (detail && typeof detail === 'object') {
    const safe = {}
    if (detail.error && typeof detail.error === 'object') {
      if (detail.error.message) safe.error = { message: String(detail.error.message).slice(0, 4000) }
      else if (detail.error.code) safe.error = { code: detail.error.code }
    }
    if (detail.message) safe.detail = String(detail.message).slice(0, 4000)
    if (!Object.keys(safe).length) safe.detail = message
    if (!safe.message) safe.message = message
    return safe
  }

  return { message }
}

async function touchLocalKey(localApiKey) {
  await LocalApiKey.findByIdAndUpdate(localApiKey._id, {
    $inc: { usageCount: 1 },
    $set: { lastUsedAt: new Date() }
  });
}

function parseStreamChunk(chunkText, state) {
  const lines = String(chunkText || '').split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    try {
      const json = JSON.parse(payload);
      const choice = json?.choices?.[0] || {};
      const delta = choice?.delta?.content;
      const message = choice?.message?.content;
      const text = typeof delta === 'string' ? delta : (typeof message === 'string' ? message : '');
      if (text) state.outputChars += text.length;

      const usage = json?.usage || {};
      const promptDetails = usage.prompt_tokens_details || {};
      if (usage.prompt_tokens || usage.input_tokens) state.promptTokens = Number(usage.prompt_tokens || usage.input_tokens || 0);
      if (usage.completion_tokens || usage.output_tokens) state.completionTokens = Number(usage.completion_tokens || usage.output_tokens || 0);
      if (usage.total_tokens) state.totalTokens = Number(usage.total_tokens || 0);
      if (promptDetails.cached_tokens || usage.cache_read_input_tokens) state.cacheReadTokens = Number(promptDetails.cached_tokens || usage.cache_read_input_tokens || 0);
      if (promptDetails.cache_creation_tokens || usage.cache_creation_input_tokens) state.cacheWriteTokens = Number(promptDetails.cache_creation_tokens || usage.cache_creation_input_tokens || 0);
    } catch (_) {
      // ignore invalid chunk json
    }
  }
}

async function chatCompletions(req, res, next) {
  try {
    const isStream = req.body?.stream === true;
    const response = await proxyOpenAiRequest({
      localApiKey: req.localApiKey,
      path: '/v1/chat/completions',
      method: 'POST',
      body: req.body,
      stream: isStream
    });

    await touchLocalKey(req.localApiKey);

    if (isStream) {
      const streamState = {
        outputChars: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        firstByteMs: 0,
        firstChunkSeen: false
      };

      res.status(response.status);
      res.setHeader('Content-Type', response.headers['content-type'] || 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', response.headers['cache-control'] || 'no-cache');
      res.setHeader('Connection', response.headers['connection'] || 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      response.data.on('data', (chunk) => {
        if (!streamState.firstChunkSeen) {
          streamState.firstChunkSeen = true;
          streamState.firstByteMs = Date.now() - response.codeAipLogStartedAt;
        }

        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        parseStreamChunk(buffer.toString('utf8'), streamState);
        res.write(buffer);
        if (typeof res.flush === 'function') res.flush();
      });

      response.data.on('end', () => {
        finalizeStreamLog(response.codeAipLogId, {
          durationMs: Date.now() - response.codeAipLogStartedAt,
          firstByteMs: streamState.firstByteMs,
          outputChars: streamState.outputChars,
          promptTokens: streamState.promptTokens,
          completionTokens: streamState.completionTokens,
          totalTokens: streamState.totalTokens,
          cacheReadTokens: streamState.cacheReadTokens,
          cacheWriteTokens: streamState.cacheWriteTokens
        }).catch(() => {});
        res.end();
      });

      response.data.on('error', (err) => {
        finalizeStreamLog(response.codeAipLogId, {
          durationMs: Date.now() - response.codeAipLogStartedAt,
          firstByteMs: streamState.firstByteMs,
          outputChars: streamState.outputChars,
          promptTokens: streamState.promptTokens,
          completionTokens: streamState.completionTokens,
          totalTokens: streamState.totalTokens,
          cacheReadTokens: streamState.cacheReadTokens,
          cacheWriteTokens: streamState.cacheWriteTokens,
          errorMessage: extractErrorMessage(err)
        }).catch(() => {});
        if (!res.headersSent) return next(err);
        res.destroy(err);
      });

      req.on('close', () => {
        if (!response.data.destroyed) {
          response.data.destroy();
        }
      });

      return;
    }

    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(buildSafeErrorBody(err))
    }
    next(err);
  }
}

async function embeddings(req, res, next) {
  try {
    const response = await proxyOpenAiRequest({ localApiKey: req.localApiKey, path: '/v1/embeddings', method: 'POST', body: req.body });
    await touchLocalKey(req.localApiKey);
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(buildSafeErrorBody(err));
    next(err);
  }
}

async function models(req, res, next) {
  try {
    const defaultUpstream = req.localApiKey.defaultUpstreamId;
    const data = (req.localApiKey.modelMappings || []).map(item => ({ id: item.localModel, object: 'model', owned_by: 'codeaip' }));
    if (data.length) return res.json({ object: 'list', data });
    return res.json({ object: 'list', data: (defaultUpstream?.models || []).map(x => ({ id: x, object: 'model', owned_by: 'codeaip' })) });
  } catch (err) { next(err); }
}

module.exports = { chatCompletions, embeddings, models };
