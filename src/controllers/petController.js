const Pet = require('../models/Pet');
const PetParent = require('../models/PetParent');

// -- Pets --

async function listPets(req, res) {
  const { species, donorStatus } = req.query;
  const filter = {};
  if (species) filter.species = species;
  if (donorStatus) filter.donorStatus = donorStatus;
  const pets = await Pet.find(filter).populate('owner').sort({ createdAt: -1 }).limit(100);
  res.json({ pets });
}

async function getPet(req, res) {
  const pet = await Pet.findById(req.params.id).populate('owner');
  if (!pet) return res.status(404).json({ error: 'Pet not found' });
  return res.json({ pet });
}

async function createPet(req, res) {
  const pet = await Pet.create(req.body);
  res.status(201).json({ pet });
}

async function updatePet(req, res) {
  const pet = await Pet.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!pet) return res.status(404).json({ error: 'Pet not found' });
  return res.json({ pet });
}

// -- Pet parents --

async function listPetParents(req, res) {
  const parents = await PetParent.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(100);
  res.json({ petParents: parents });
}

async function getPetParent(req, res) {
  const parent = await PetParent.findById(req.params.id);
  if (!parent) return res.status(404).json({ error: 'PetParent not found' });
  return res.json({ petParent: parent });
}

async function createPetParent(req, res) {
  const parent = await PetParent.create(req.body);
  res.status(201).json({ petParent: parent });
}

async function updatePetParent(req, res) {
  const parent = await PetParent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!parent) return res.status(404).json({ error: 'PetParent not found' });
  return res.json({ petParent: parent });
}

module.exports = {
  listPets,
  getPet,
  createPet,
  updatePet,
  listPetParents,
  getPetParent,
  createPetParent,
  updatePetParent,
};
