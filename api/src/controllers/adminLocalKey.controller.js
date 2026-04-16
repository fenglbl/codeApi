const LocalApiKey = require('../models/LocalApiKey');
const RequestLog = require('../models/RequestLog');
const { generateLocalApiKey, hashKey, getKeyPrefix } = require('../utils/key');
const { encrypt, decrypt } = require('../services/crypto.service');

function maskKey(rawKey) {
  if (!rawKey) return '';
  if (rawKey.length <= 12) return `${rawKey.slice(0, 4)}****`;
  return `${rawKey.slice(0, 10)}******${rawKey.slice(-6)}`;
}

function serialize(doc, tokenStats = {}) {
  const rawKey = doc.rawKeyEncrypted && doc.rawKeyIv ? decrypt(doc.rawKeyEncrypted, doc.rawKeyIv) : '';
  return {
    id: doc._id,
    name: doc.name,
    keyPrefix: doc.keyPrefix,
    maskedKey: maskKey(rawKey),
    enabled: doc.enabled,
    remark: doc.remark,
    upstreamBindings: doc.upstreamBindings || [],
    defaultUpstreamId: doc.defaultUpstreamId,
    modelMappings: doc.modelMappings || [],
    lastUsedAt: doc.lastUsedAt,
    usageCount: doc.usageCount,
    promptTokens: tokenStats.promptTokens || 0,
    completionTokens: tokenStats.completionTokens || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

async function list(req, res, next) {
  try {
    const rows = await LocalApiKey.find().populate('upstreamBindings defaultUpstreamId').sort({ createdAt: -1 });
    const ids = rows.map(item => item._id);
    const tokenRows = await RequestLog.aggregate([
      { $match: { localKeyId: { $in: ids } } },
      {
        $group: {
          _id: '$localKeyId',
          promptTokens: { $sum: { $ifNull: ['$promptTokens', 0] } },
          completionTokens: { $sum: { $ifNull: ['$completionTokens', 0] } }
        }
      }
    ]);
    const tokenMap = new Map(tokenRows.map(item => [String(item._id), {
      promptTokens: item.promptTokens || 0,
      completionTokens: item.completionTokens || 0
    }]));
    res.json(rows.map(row => serialize(row, tokenMap.get(String(row._id)) || {})));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, enabled = true, remark = '', upstreamBindings = [], defaultUpstreamId = null, modelMappings = [] } = req.body || {};
    if (!name) return res.status(400).json({ message: 'name is required' });
    const rawKey = generateLocalApiKey();
    const { encrypted, iv } = encrypt(rawKey);
    const doc = await LocalApiKey.create({
      name,
      keyPrefix: getKeyPrefix(rawKey),
      keyHash: hashKey(rawKey),
      rawKeyEncrypted: encrypted,
      rawKeyIv: iv,
      enabled,
      remark,
      upstreamBindings,
      defaultUpstreamId: defaultUpstreamId || upstreamBindings[0] || null,
      modelMappings
    });
    const populated = await LocalApiKey.findById(doc._id).populate('upstreamBindings defaultUpstreamId');
    res.status(201).json({ ...serialize(populated), rawKey });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const doc = await LocalApiKey.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const { name, enabled, remark, upstreamBindings, defaultUpstreamId, modelMappings } = req.body || {};
    if (name !== undefined) doc.name = name;
    if (enabled !== undefined) doc.enabled = enabled;
    if (remark !== undefined) doc.remark = remark;
    if (upstreamBindings !== undefined) doc.upstreamBindings = upstreamBindings;
    if (defaultUpstreamId !== undefined) doc.defaultUpstreamId = defaultUpstreamId;
    if (modelMappings !== undefined) doc.modelMappings = modelMappings;
    await doc.save();
    const populated = await LocalApiKey.findById(doc._id).populate('upstreamBindings defaultUpstreamId');
    res.json(serialize(populated));
  } catch (err) { next(err); }
}

async function toggle(req, res, next) {
  try {
    const doc = await LocalApiKey.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    doc.enabled = !doc.enabled;
    await doc.save();
    res.json(serialize(doc));
  } catch (err) { next(err); }
}

async function regenerate(req, res, next) {
  try {
    const doc = await LocalApiKey.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const rawKey = generateLocalApiKey();
    const { encrypted, iv } = encrypt(rawKey);
    doc.keyPrefix = getKeyPrefix(rawKey);
    doc.keyHash = hashKey(rawKey);
    doc.rawKeyEncrypted = encrypted;
    doc.rawKeyIv = iv;
    await doc.save();
    res.json({ success: true, rawKey, keyPrefix: doc.keyPrefix, maskedKey: maskKey(rawKey) });
  } catch (err) { next(err); }
}

async function revealRawKey(req, res, next) {
  try {
    const doc = await LocalApiKey.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const rawKey = decrypt(doc.rawKeyEncrypted, doc.rawKeyIv);
    res.json({ id: doc._id, rawKey, maskedKey: maskKey(rawKey) });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const doc = await LocalApiKey.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    await doc.deleteOne();
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, create, update, toggle, regenerate, revealRawKey, remove };
