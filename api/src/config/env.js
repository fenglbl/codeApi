const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 18080),
  mongodbUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'replace_me',
  appEncryptionKey: process.env.APP_ENCRYPTION_KEY || 'replace_with_32_byte_key',
  upstreamTimeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS || 150000),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123456'
};
