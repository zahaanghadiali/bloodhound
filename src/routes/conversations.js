const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const conversationController = require('../controllers/conversationController');

const router = express.Router();

router.get('/:id', asyncHandler(conversationController.getConversation));
router.post('/:id/pause', asyncHandler(conversationController.pause));
router.post('/:id/resume', asyncHandler(conversationController.resume));
router.post('/:id/delete', asyncHandler(conversationController.remove));

module.exports = router;
