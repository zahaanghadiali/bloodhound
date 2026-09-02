const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const mockController = require('../controllers/mockController');

const router = express.Router();

router.post('/incoming', asyncHandler(mockController.incoming));

module.exports = router;
