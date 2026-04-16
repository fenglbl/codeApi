const express = require('express');
const adminAuth = require('../middlewares/adminAuth.middleware');
const controller = require('../controllers/adminUpstream.controller');

const router = express.Router();
router.use(adminAuth);
router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.post('/:id/test', controller.testConnection);
router.post('/:id/fetch-models', controller.fetchModels);
router.patch('/:id/toggle', controller.toggle);
router.delete('/:id', controller.remove);
module.exports = router;
