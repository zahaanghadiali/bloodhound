/**
 * Loads the list of countries for the location picker.
 * @return {Promise<Array<{code: string, name: string}>>} Countries sorted by
 *     name.
 * @throws {Error} If the request fails.
 */
export async function fetchCountries() {
  const res = await fetch('/api/geo/countries');
  if (!res.ok) throw new Error('Could not load the country list.');
  const data = await res.json();
  return data.countries || [];
}

/**
 * Searches cities in a country by name prefix.
 * @param {string} countryCode ISO 3166-1 alpha-2 country code.
 * @param {string} query Name prefix to search for.
 * @return {Promise<Array<{id: number, name: string, lat: number, lng:
 *     number}>>} Matching cities; empty when no country is given.
 * @throws {Error} If the request fails.
 */
export async function searchCities(countryCode, query) {
  if (!countryCode) return [];
  const params = new URLSearchParams({ country: countryCode, q: query || '' });
  const res = await fetch(`/api/geo/cities?${params.toString()}`);
  if (!res.ok) throw new Error('Could not load cities.');
  const data = await res.json();
  return data.cities || [];
}
