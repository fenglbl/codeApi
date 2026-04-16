const express = require('express');
const adminAuth = require('../middlewares/adminAuth.middleware');
const controller = require('../controllers/adminLocalKey.controller');

const router = express.Router();
router.use(adminAuth);
router.get('/', controller.list);
router.get('/:id/raw-key', controller.revealRawKey);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/toggle', controller.toggle);
router.post('/:id/regenerate', controller.regenerate);
router.delete('/:id', controller.remove);
module.exports = router;
