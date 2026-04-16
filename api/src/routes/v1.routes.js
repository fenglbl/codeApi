const express = require('express');
const localApiKeyAuth = require('../middlewares/localApiKey.middleware');
const controller = require('../controllers/v1Proxy.controller');

const router = express.Router();
router.use(localApiKeyAuth);
router.post('/chat/completions', controller.chatCompletions);
router.post('/embeddings', controller.embeddings);
router.get('/models', controller.models);
module.exports = router;
