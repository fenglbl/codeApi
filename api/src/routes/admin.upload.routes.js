const express = require('express');
const adminAuth = require('../middlewares/adminAuth.middleware');
const controller = require('../controllers/adminUpload.controller');

const router = express.Router();
router.use(adminAuth);
router.post('/chat-image', controller.uploadMiddleware, controller.uploadChatImageHandler);

module.exports = router;
