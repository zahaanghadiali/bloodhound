const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const donorController = require('../controllers/donorController');

const router = express.Router();

router.get('/search', asyncHandler(donorController.search));

module.exports = router;
