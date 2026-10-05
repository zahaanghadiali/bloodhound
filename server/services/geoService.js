const cities = require('all-the-cities');
const { geocoding } = require('../config/env');
const logger = require('../utils/logger');

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

function countryName(code) {
  if (!code) return null;
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase());
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

/** City + country for a coordinate from the bundled dataset alone — no network, but no neighbourhood either. */
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

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(geocoding.timeoutMs) });
  if (!res.ok) throw new Error(`geocoder responded ${res.status}`);
  return res.json();
}

/** Google Geocoding API — used when GOOGLE_MAPS_API_KEY is set. */
async function googleReverseGeocode(lat, lng) {
  const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: geocoding.googleApiKey, language: 'en' });
  const data = await fetchJson(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  if (data.status !== 'OK') throw new Error(`google geocoder: ${data.status}`);

  // Results run most- to least-specific; each field comes from the first
  // result that has it, so a precise street result still yields a city.
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

/** OpenStreetMap Nominatim — the keyless default. Fine at this app's volume (one lookup per shared location); its usage policy needs an identifying User-Agent. */
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
 * Turns shared coordinates into { area, city, state, country, countryCode }.
 * Asks an online geocoder for the neighbourhood-level detail and falls back
 * to the bundled nearest-city lookup (city + country only) if that fails or
 * times out, so a shared location is never left without at least a city.
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

/** "Bandra West, Mumbai, India" — the one-line form saved as locationText. */
function formatAddress(address) {
  if (!address) return null;
  return [address.area, address.city, address.country].filter(Boolean).join(', ') || null;
}

module.exports = { getCountries, searchCities, reverseGeocode, formatAddress };
