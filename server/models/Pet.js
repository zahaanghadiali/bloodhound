const mongoose = require('mongoose');

const addressSchema = require('./addressSchema');

const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
  { _id: false }
);

const petSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'PetParent', required: true },
    species: { type: String, enum: ['dog', 'cat'], required: true },
    sex: { type: String, enum: ['male', 'female'] },
    name: { type: String, trim: true },
    // Exactly one of these is set when the pet has a photo: `photoKey` for
    // a real storage provider (S3) — the bucket is private, so the API
    // swaps it for a fresh signed `photoUrl` on every read (see
    // documentStorageService.hydratePet) — or `photoUrl` itself, as a data
    // URL, for the inline provider.
    photoKey: { type: String },
    photoUrl: { type: String, default: null },
    dob: { type: Date },
    weightKg: { type: Number },
    breed: { type: String, trim: true },
    bloodType: {
      known: { type: Boolean, default: false },
      value: { type: String, trim: true },
    },
    vaccinated: { type: Boolean },
    healthConditions: {
      has: { type: Boolean, default: false },
      notes: { type: String, trim: true },
    },
    location: { type: pointSchema },
    address: { type: addressSchema },
    locationText: { type: String, trim: true },
    donorStatus: { type: String, enum: ['active', 'paused', 'deleted'], default: 'active' },
  },
  { timestamps: true }
);

petSchema.index({ location: '2dsphere' });
petSchema.index({ species: 1, donorStatus: 1 });

module.exports = mongoose.model('Pet', petSchema);
