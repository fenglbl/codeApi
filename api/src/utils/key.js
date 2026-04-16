const crypto = require('crypto');

function generateLocalApiKey() {
  return `sk-local-${crypto.randomBytes(24).toString('hex')}`;
}

function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

function getKeyPrefix(key) {
  return String(key).slice(0, 14);
}

module.exports = { generateLocalApiKey, hashKey, getKeyPrefix };
