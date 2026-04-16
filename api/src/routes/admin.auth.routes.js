const express = require('express');
const { login, me } = require('../controllers/adminAuth.controller');
const adminAuth = require('../middlewares/adminAuth.middleware');

const router = express.Router();
router.post('/login', login);
router.get('/me', adminAuth, me);
module.exports = router;
