const axios = require('axios');
const UpstreamProvider = require('../models/UpstreamProvider');
const LocalApiKey = require('../models/LocalApiKey');
const { encrypt, decrypt } = require('../services/crypto.service');

function serialize(doc) {
  return {
    id: doc._id,
    name: doc.name,
    baseUrl: doc.baseUrl,
    enabled: doc.enabled,
    remark: doc.remark,
    models: doc.models || [],
    apiKeyMasked: '********',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

function buildModelsUrl(baseUrl) {
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  return normalized.endsWith('/v1') ? `${normalized}/models` : `${normalized}/v1/models`;
}

async function requestModels(baseUrl, apiKey) {
  const startedAt = Date.now();
  const response = await axios.get(buildModelsUrl(baseUrl), {
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  const models = Array.isArray(response.data?.data)
    ? response.data.data.map(item => item?.id).filter(Boolean)
    : [];

  return {
    ok: true,
    latencyMs: Date.now() - startedAt,
    modelCount: models.length,
    models,
    raw: response.data
  };
}

async function list(req, res, next) {
  try {
    const rows = await UpstreamProvider.find().sort({ createdAt: -1 });
    res.json(rows.map(serialize));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, baseUrl, apiKey, enabled = true, remark = '', models = [] } = req.body || {};
    if (!name || !baseUrl || !apiKey) return res.status(400).json({ message: 'name, baseUrl, apiKey are required' });
    const { encrypted, iv } = encrypt(apiKey);
    const doc = await UpstreamProvider.create({ name, baseUrl, apiKeyEncrypted: encrypted, apiKeyIv: iv, enabled, remark, models });
    res.status(201).json(serialize(doc));
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, baseUrl, apiKey, enabled, remark, models } = req.body || {};
    const doc = await UpstreamProvider.findById(id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (name !== undefined) doc.name = name;
    if (baseUrl !== undefined) doc.baseUrl = baseUrl;
    if (enabled !== undefined) doc.enabled = enabled;
    if (remark !== undefined) doc.remark = remark;
    if (models !== undefined) doc.models = models;
    if (apiKey) {
      const { encrypted, iv } = encrypt(apiKey);
      doc.apiKeyEncrypted = encrypted;
      doc.apiKeyIv = iv;
    }
    await doc.save();
    res.json(serialize(doc));
  } catch (err) { next(err); }
}

async function toggle(req, res, next) {
  try {
    const doc = await UpstreamProvider.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    doc.enabled = !doc.enabled;
    await doc.save();
    res.json(serialize(doc));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const doc = await UpstreamProvider.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    const bindCount = await LocalApiKey.countDocuments({
      $or: [
        { upstreamBindings: doc._id },
        { defaultUpstreamId: doc._id }
      ]
    });

    if (bindCount > 0) {
      return res.status(409).json({
        message: '该上游仍被本地 Key 绑定，不能删除',
        bindCount
      });
    }

    await doc.deleteOne();
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function fetchModels(req, res) {
  try {
    const doc = await UpstreamProvider.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    const apiKey = decrypt(doc.apiKeyEncrypted, doc.apiKeyIv);
    const result = await requestModels(doc.baseUrl, apiKey);

    doc.models = result.models;
    await doc.save();

    res.json({
      message: '模型列表已更新',
      ...result,
      provider: serialize(doc)
    });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.response?.data?.message || err.message || '获取模型失败';
    res.status(400).json({ message, detail: err.response?.data || null });
  }
}

async function testConnection(req, res) {
  try {
    const doc = await UpstreamProvider.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    const apiKey = decrypt(doc.apiKeyEncrypted, doc.apiKeyIv);
    const result = await requestModels(doc.baseUrl, apiKey);

    res.json({
      message: '连接正常',
      ok: true,
      latencyMs: result.latencyMs,
      modelCount: result.modelCount,
      sampleModels: result.models.slice(0, 10)
    });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.response?.data?.message || err.message || '连接测试失败';
    res.status(400).json({
      message,
      ok: false,
      detail: err.response?.data || null
    });
  }
}

module.exports = { list, create, update, toggle, remove, fetchModels, testConnection };
