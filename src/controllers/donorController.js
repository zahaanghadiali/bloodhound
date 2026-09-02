const matchingService = require('../services/matchingService');

/** GET /api/donors/search?species=dog&lat=..&lng=..&radiusKm=.. OR ?species=dog&city=Mumbai */
async function search(req, res) {
  const { species, lat, lng, radiusKm, city } = req.query;
  if (!species || !['dog', 'cat'].includes(species)) {
    return res.status(400).json({ error: 'species must be "dog" or "cat"' });
  }

  const hasCoords = lat !== undefined && lng !== undefined;
  const donors = await matchingService.searchDonors({
    species,
    point: hasCoords ? { coordinates: [parseFloat(lng), parseFloat(lat)] } : null,
    locationText: hasCoords ? null : city,
    radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
  });

  return res.json({ donors });
}

module.exports = { search };
