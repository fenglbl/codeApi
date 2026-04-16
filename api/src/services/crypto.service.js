const crypto = require('crypto');
const env = require('../config/env');

function getKey() {
  return crypto.createHash('sha256').update(env.appEncryptionKey).digest();
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return { encrypted: encrypted.toString('base64'), iv: iv.toString('base64') };
}

function decrypt(encryptedText, ivText) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), Buffer.from(ivText, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
