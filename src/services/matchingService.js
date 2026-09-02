const Pet = require('../models/Pet');
const { defaultSearchRadiusKm } = require('../config/env');

function kmToMeters(km) {
  return km * 1000;
}

function calcAgeYears(dob) {
  if (!dob) return null;
  const diffMs = Date.now() - new Date(dob).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
}

/**
 * Find active donor pets. Prefers a geo query when a coordinate is available;
 * falls back to a plain text match on locationText (e.g. the user typed a
 * city instead of sharing a pin, or we don't have geocoding wired up yet).
 */
async function searchDonors({ species, point, locationText, radiusKm }) {
  const baseFilter = { species, donorStatus: 'active' };
  const radiusMeters = kmToMeters(radiusKm || defaultSearchRadiusKm);

  let pets;
  if (point) {
    pets = await Pet.find({
      ...baseFilter,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: point.coordinates },
          $maxDistance: radiusMeters,
        },
      },
    })
      .populate('owner')
      .limit(20);
  } else if (locationText) {
    pets = await Pet.find({
      ...baseFilter,
      locationText: { $regex: locationText, $options: 'i' },
    })
      .populate('owner')
      .limit(20);
  } else {
    pets = [];
  }

  return pets.map((pet) => ({
    id: pet._id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    ageYears: calcAgeYears(pet.dob),
    weightKg: pet.weightKg,
    bloodType: pet.bloodType?.known ? pet.bloodType.value : 'Unknown',
    locationText: pet.locationText,
    ownerName: pet.owner?.name,
    ownerPhone: pet.owner?.phone,
  }));
}

module.exports = { searchDonors };
