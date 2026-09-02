const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/webhooks', require('./webhooks'));
router.use('/api/mock', require('./mock'));
router.use('/api/donors', require('./donors'));
router.use('/api/pets', require('./pets'));
router.use('/api/pet-parents', require('./petParents'));
router.use('/api/conversations', require('./conversations'));

module.exports = router;
