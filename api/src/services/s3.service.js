const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');
const env = require('../config/env');

function ensureS3Enabled() {
  if (!env.s3Enabled) {
    const err = new Error('S3 / MinIO 未启用');
    err.statusCode = 400;
    throw err;
  }
}

function getS3Client() {
  ensureS3Enabled();
  return new S3Client({
    region: env.s3Region,
    endpoint: env.s3Endpoint || undefined,
    forcePathStyle: env.s3ForcePathStyle,
    credentials: {
      accessKeyId: env.s3AccessKey,
      secretAccessKey: env.s3SecretKey
    }
  });
}

function buildObjectKey(originalName = 'image.jpg') {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const random = crypto.randomUUID();
  return `chat/${y}/${m}/${d}/${random}${ext}`;
}

async function uploadChatImage({ buffer, mimeType, originalName }) {
  const client = getS3Client();
  const objectKey = buildObjectKey(originalName);
  await client.send(new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType
  }));

  const url = env.s3PublicBaseUrl
    ? `${String(env.s3PublicBaseUrl).replace(/\/+$/, '')}/${objectKey}`
    : `${String(env.s3Endpoint).replace(/\/+$/, '')}/${env.s3Bucket}/${objectKey}`;

  return { objectKey, url };
}

module.exports = {
  uploadChatImage
};
