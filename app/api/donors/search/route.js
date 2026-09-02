const { NextResponse } = require('next/server');
const { apiHandler } = require('../../../../lib/utils/apiHandler');
const matchingService = require('../../../../lib/services/matchingService');

/** GET /api/donors/search?species=dog&lat=..&lng=..&radiusKm=.. OR ?species=dog&city=Mumbai */
const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const species = searchParams.get('species');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radiusKm = searchParams.get('radiusKm');
  const city = searchParams.get('city');

  if (!species || !['dog', 'cat'].includes(species)) {
    return NextResponse.json({ error: 'species must be "dog" or "cat"' }, { status: 400 });
  }

  const hasCoords = lat !== null && lng !== null;
  const donors = await matchingService.searchDonors({
    species,
    point: hasCoords ? { coordinates: [parseFloat(lng), parseFloat(lat)] } : null,
    locationText: hasCoords ? null : city,
    radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
  });

  return NextResponse.json({ donors });
});

module.exports = { GET };
