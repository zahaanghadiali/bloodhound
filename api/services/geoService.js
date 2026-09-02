const cities = require('all-the-cities');

/**
 * Country + city lookup for the manual location picker, backed entirely by
 * the bundled `all-the-cities` dataset — no geocoding API or key required.
 * The by-country index is built once per warm process (mirrors the
 * connection-caching pattern in api/config/db.js).
 */
let citiesByCountry = null;

function indexCities() {
  if (citiesByCountry) return citiesByCountry;
  citiesByCountry = new Map();
  for (const city of cities) {
    if (!citiesByCountry.has(city.country)) citiesByCountry.set(city.country, []);
    citiesByCountry.get(city.country).push(city);
  }
  return citiesByCountry;
}

function getCountries() {
  const byCountry = indexCities();
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

  return [...byCountry.keys()]
    .map((code) => {
      let name;
      try {
        name = regionNames.of(code);
      } catch {
        name = null;
      }
      return { code, name: name && name !== code ? name : null };
    })
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function searchCities(countryCode, query, limit = 8) {
  const byCountry = indexCities();
  const list = byCountry.get(countryCode) || [];
  const q = (query || '').trim().toLowerCase();
  const filtered = q ? list.filter((c) => c.name.toLowerCase().startsWith(q)) : list;

  return [...filtered]
    .sort((a, b) => b.population - a.population)
    .slice(0, limit)
    .map((c) => ({
      id: c.cityId,
      name: c.name,
      lat: c.loc.coordinates[1],
      lng: c.loc.coordinates[0],
    }));
}

module.exports = { getCountries, searchCities };
