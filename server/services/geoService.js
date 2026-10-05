const cities = require('all-the-cities');
const { geocoding } = require('../config/env');
const logger = require('../utils/logger');

let citiesByCountry = null;

/**
 * Groups the bundled all-the-cities dataset by country code. The index is built
 * once per warm process.
 * @return {Map<string, Array<Object>>} Cities keyed by ISO country code.
 */
function indexCities() {
  if (citiesByCountry) return citiesByCountry;
  citiesByCountry = new Map();
  for (const city of cities) {
    if (!citiesByCountry.has(city.country)) citiesByCountry.set(city.country, []);
    citiesByCountry.get(city.country).push(city);
  }
  return citiesByCountry;
}

/**
 * Lists every country that has at least one city in the dataset.
 * @return {Array<{code: string, name: string}>} Countries sorted by English
 *     name; codes with no known name are left out.
 */
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

/**
 * Finds the largest cities in a country whose names start with a query.
 * @param {string} countryCode Upper-case ISO 3166-1 alpha-2 country code.
 * @param {?string} query Name prefix to match; empty matches every city.
 * @param {number=} limit Maximum number of cities to return. Defaults to 8.
 * @return {Array<{id: number, name: string, lat: number, lng: number}>}
 *     Matching cities, most populous first.
 */
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

/**
 * Looks up the English name of a country.
 * @param {?string} code ISO 3166-1 alpha-2 country code.
 * @return {?string} The country name, or null if the code is missing or
 *     unknown.
 */
function countryName(code) {
  if (!code) return null;
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase());
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

/**
 * Finds the city nearest to a coordinate using only the bundled dataset, so it
 * needs no network but knows no neighbourhood.
 * @param {number} lat Latitude in degrees.
 * @param {number} lng Longitude in degrees.
 * @return {?{area: null, city: string, state: null, country: ?string,
 *     countryCode: string}} The nearest city's address, or null if the dataset
 *     is empty.
 */
function nearestCityAddress(lat, lng) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best = null;
  let bestDistance = Infinity;
  for (const city of cities) {
    const [cityLng, cityLat] = city.loc.coordinates;
    const dLat = cityLat - lat;
    let dLng = Math.abs(cityLng - lng);
    if (dLng > 180) dLng = 360 - dLng;
    dLng *= cosLat;
    const distance = dLat * dLat + dLng * dLng;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = city;
    }
  }
  if (!best) return null;
  return { area: null, city: best.name, state: null, country: countryName(best.country), countryCode: best.country };
}

/**
 * Fetches a geocoder URL as JSON, aborting after the configured timeout.
 * @param {string} url URL to fetch.
 * @param {Object=} headers Request headers.
 * @return {Promise<Object>} The parsed JSON body.
 * @throws {Error} If the request times out, fails, or returns a non-2xx status.
 */
async function fetchJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(geocoding.timeoutMs) });
  if (!res.ok) throw new Error(`geocoder responded ${res.status}`);
  return res.json();
}

/**
 * Reverse geocodes a coordinate with the Google Geocoding API.
 * @param {number} lat Latitude in degrees.
 * @param {number} lng Longitude in degrees.
 * @return {Promise<{area: ?string, city: ?string, state: ?string, country:
 *     ?string, countryCode: ?string}>} The address parts Google could resolve.
 * @throws {Error} If the request fails or Google reports a status other than
 *     OK.
 */
async function googleReverseGeocode(lat, lng) {
  const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: geocoding.googleApiKey, language: 'en' });
  const data = await fetchJson(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  if (data.status !== 'OK') throw new Error(`google geocoder: ${data.status}`);

  /**
   * Finds the first address component of any of the given types, searching
   * results from most to least specific.
   * @param {...string} types Google address component types to look for.
   * @return {?Object} The matching address component, or null.
   */
  const find = (...types) => {
    for (const result of data.results) {
      const match = result.address_components.find((c) => types.some((t) => c.types.includes(t)));
      if (match) return match;
    }
    return null;
  };
  const country = find('country');
  return {
    area: find('sublocality_level_1', 'sublocality', 'neighborhood')?.long_name || null,
    city: find('locality', 'postal_town', 'administrative_area_level_2')?.long_name || null,
    state: find('administrative_area_level_1')?.long_name || null,
    country: country?.long_name || null,
    countryCode: country?.short_name || null,
  };
}

/**
 * Reverse geocodes a coordinate with OpenStreetMap's keyless Nominatim service.
 * @param {number} lat Latitude in degrees.
 * @param {number} lng Longitude in degrees.
 * @return {Promise<{area: ?string, city: ?string, state: ?string, country:
 *     ?string, countryCode: ?string}>} The address parts Nominatim could
 *     resolve.
 * @throws {Error} If the request fails or the response has no address.
 */
async function nominatimReverseGeocode(lat, lng) {
  const params = new URLSearchParams({ format: 'jsonv2', lat, lon: lng, zoom: 16, addressdetails: 1, 'accept-language': 'en' });
  const contact = geocoding.contactEmail ? ` (${geocoding.contactEmail})` : '';
  const data = await fetchJson(`https://nominatim.openstreetmap.org/reverse?${params}`, { 'User-Agent': `Bloodhound/0.1${contact}` });
  const a = data.address;
  if (!a) throw new Error(data.error || 'nominatim: no address');
  return {
    area: a.suburb || a.neighbourhood || a.quarter || a.city_district || a.residential || null,
    city: a.city || a.town || a.village || a.municipality || a.county || a.state_district || null,
    state: a.state || null,
    country: a.country || null,
    countryCode: a.country_code ? a.country_code.toUpperCase() : null,
  };
}

/**
 * Turns shared coordinates into an address. An online geocoder supplies
 * neighbourhood-level detail; if it fails or times out, the bundled
 * nearest-city lookup is used so a location always has at least a city.
 * @param {number} lat Latitude in degrees.
 * @param {number} lng Longitude in degrees.
 * @return {Promise<?{area: ?string, city: ?string, state: ?string, country:
 *     ?string, countryCode: ?string}>} The resolved address, or null if even
 *     the nearest-city lookup found nothing.
 */
async function reverseGeocode(lat, lng) {
  try {
    const address = geocoding.googleApiKey ? await googleReverseGeocode(lat, lng) : await nominatimReverseGeocode(lat, lng);
    if (address.city || address.area) {
      if (address.area === address.city) address.area = null;
      return address;
    }
  } catch (err) {
    logger.warn('reverse geocoding failed, falling back to nearest city', { error: err.message });
  }
  return nearestCityAddress(lat, lng);
}

/**
 * Formats an address as one line, such as "Bandra West, Mumbai, India".
 * @param {?{area: ?string, city: ?string, country: ?string}} address Address to
 *     format.
 * @return {?string} The comma-separated line, or null if there is nothing to
 *     show.
 */
function formatAddress(address) {
  if (!address) return null;
  return [address.area, address.city, address.country].filter(Boolean).join(', ') || null;
}

module.exports = { getCountries, searchCities, reverseGeocode, formatAddress };
