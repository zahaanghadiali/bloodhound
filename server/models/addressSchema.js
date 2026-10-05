const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    countryCode: { type: String, trim: true, uppercase: true },
  },
  { _id: false }
);

module.exports = addressSchema;
