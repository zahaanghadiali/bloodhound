const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const petController = require('../controllers/petController');

const router = express.Router();

router.get('/', asyncHandler(petController.listPets));
router.post('/', asyncHandler(petController.createPet));
router.get('/:id', asyncHandler(petController.getPet));
router.patch('/:id', asyncHandler(petController.updatePet));

module.exports = router;
