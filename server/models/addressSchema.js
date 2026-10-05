const mongoose = require('mongoose');

/**
 * Human-readable place for a shared location, stored next to (not inside)
 * the GeoJSON `location` point — that field is 2dsphere-indexed, so it stays
 * a bare { type, coordinates }. Filled in by geoService.reverseGeocode when
 * coordinates are shared; `area` is the neighbourhood/locality within the
 * city and is only known when an online geocoder answered.
 */
const addressSchema = new mongoose.Schema(
  {
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    countryCode: { type: String, trim: true, uppercase: true }, // ISO 3166-1 alpha-2
  },
  { _id: false }
);

module.exports = addressSchema;
