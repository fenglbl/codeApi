const multer = require('multer');
const env = require('../config/env');
const { uploadChatImage } = require('../services/s3.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.chatImageMaxMb * 1024 * 1024
  }
});

const uploadMiddleware = upload.single('file');

async function uploadChatImageHandler(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: '请选择图片文件' });
    if (!env.chatImageAllowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: '当前只支持 jpeg/png/webp 图片' });
    }

    const result = await uploadChatImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    });

    res.json({
      id: result.objectKey,
      objectKey: result.objectKey,
      url: result.url,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadMiddleware,
  uploadChatImageHandler
};
