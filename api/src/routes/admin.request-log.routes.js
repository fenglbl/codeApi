const express = require('express');
const adminAuth = require('../middlewares/adminAuth.middleware');
const controller = require('../controllers/adminRequestLog.controller');

const router = express.Router();
router.use(adminAuth);
router.get('/', controller.list);

module.exports = router;
