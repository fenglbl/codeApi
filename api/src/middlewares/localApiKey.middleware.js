const LocalApiKey = require('../models/LocalApiKey');
const { hashKey } = require('../utils/key');

module.exports = async function localApiKeyAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: { message: 'Missing API key' } });

    const localKey = await LocalApiKey.findOne({ keyHash: hashKey(token), enabled: true }).populate('upstreamBindings defaultUpstreamId');
    if (!localKey) return res.status(401).json({ error: { message: 'Invalid API key' } });

    req.localApiKey = localKey;
    req.localApiKeyRaw = token;
    next();
  } catch (err) {
    next(err);
  }
};
