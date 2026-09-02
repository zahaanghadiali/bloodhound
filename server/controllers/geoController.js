const { NextResponse } = require('next/server');
const geoService = require('../services/geoService');

/** GET /api/geo/countries — static in-memory dataset, no DB or API key needed. */
const countries = async () => {
  try {
    return NextResponse.json({ countries: geoService.getCountries() });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
};

/** GET /api/geo/cities?country=IN&q=mum — top matches by population, with lat/lng. */
const cities = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country');
    const q = searchParams.get('q') || '';
    if (!country) {
      return NextResponse.json({ error: 'country is required' }, { status: 400 });
    }
    return NextResponse.json({ cities: geoService.searchCities(country.toUpperCase(), q) });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
};

module.exports = { countries, cities };
