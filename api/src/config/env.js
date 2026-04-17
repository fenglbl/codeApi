const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 18080),
  mongodbUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'replace_me',
  appEncryptionKey: process.env.APP_ENCRYPTION_KEY || 'replace_with_32_byte_key',
  upstreamTimeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS || 150000),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '12mb',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123456',
  s3Enabled: String(process.env.S3_ENABLED || 'false') === 'true',
  s3Endpoint: process.env.S3_ENDPOINT || '',
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3Bucket: process.env.S3_BUCKET || 'codeaip-chat',
  s3AccessKey: process.env.S3_ACCESS_KEY || '',
  s3SecretKey: process.env.S3_SECRET_KEY || '',
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
  s3ForcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || 'true') !== 'false',
  chatImageMaxMb: Number(process.env.CHAT_IMAGE_MAX_MB || 8),
  chatImageAllowedTypes: String(process.env.CHAT_IMAGE_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
};
