export async function fetchCountries() {
  const res = await fetch('/api/geo/countries');
  if (!res.ok) throw new Error('Could not load the country list.');
  const data = await res.json();
  return data.countries || [];
}

export async function searchCities(countryCode, query) {
  if (!countryCode) return [];
  const params = new URLSearchParams({ country: countryCode, q: query || '' });
  const res = await fetch(`/api/geo/cities?${params.toString()}`);
  if (!res.ok) throw new Error('Could not load cities.');
  const data = await res.json();
  return data.cities || [];
}
