const mongoose = require('mongoose');

const addressSchema = require('./addressSchema');

const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined },
  },
  { _id: false }
);

const petParentSchema = new Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    channel: { type: String, enum: ['whatsapp', 'instagram', 'mock'], required: true },
    externalUserId: { type: String, required: true },
    location: { type: pointSchema },
    address: { type: addressSchema },
    locationText: { type: String, trim: true },
    phoneVerifiedAt: { type: Date, default: null },
    emailVerifiedAt: { type: Date, default: null },
    consentAcceptedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

petParentSchema.index({ channel: 1, externalUserId: 1 }, { unique: true });
petParentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('PetParent', petParentSchema);
