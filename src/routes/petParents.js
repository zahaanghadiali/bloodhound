const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const petController = require('../controllers/petController');

const router = express.Router();

router.get('/', asyncHandler(petController.listPetParents));
router.post('/', asyncHandler(petController.createPetParent));
router.get('/:id', asyncHandler(petController.getPetParent));
router.patch('/:id', asyncHandler(petController.updatePetParent));

module.exports = router;
