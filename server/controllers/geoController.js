const { NextResponse } = require('next/server');
const geoService = require('../services/geoService');

/**
 * Handles GET /api/geo/countries from a static in-memory dataset.
 * @return {Promise<Response>} JSON with the country list, or a 500 error.
 */
const countries = async () => {
  try {
    return NextResponse.json({ countries: geoService.getCountries() });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
};

/**
 * Handles GET /api/geo/cities?country=IN&q=mum.
 * @param {Request} req Request with country and optional q query params.
 * @return {Promise<Response>} JSON with the top matching cities by population;
 *     400 if country is missing, 500 on failure.
 */
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
