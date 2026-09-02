const express = require('express');
const webhookController = require('../controllers/webhookController');

const router = express.Router();

router.get('/whatsapp', webhookController.verify('whatsapp'));
router.post('/whatsapp', webhookController.receive('whatsapp'));

router.get('/instagram', webhookController.verify('instagram'));
router.post('/instagram', webhookController.receive('instagram'));

module.exports = router;
