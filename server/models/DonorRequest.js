const mongoose = require('mongoose');

const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined },
  },
  { _id: false }
);

const notifiedOwnerSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'PetParent', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired'], default: 'pending' },
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', default: null },
    notifiedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  { _id: false }
);

const donorRequestSchema = new Schema(
  {
    searcher: { type: Schema.Types.ObjectId, ref: 'PetParent', required: true },
    species: { type: String, enum: ['dog', 'cat'], required: true },
    searchMode: { type: String, enum: ['radius', 'text'], required: true, default: 'radius' },
    location: { type: pointSchema, default: undefined },
    locationText: { type: String, trim: true },
    maxRadiusKm: { type: Number, default: null },
    currentRadiusKm: { type: Number, default: null },
    phase: {
      type: String,
      enum: ['active', 'awaiting_unlimited_confirmation', 'unlimited', 'stopped', 'expired'],
      default: 'active',
    },
    nextExpansionAt: { type: Date, default: null },
    notifiedOwners: { type: [notifiedOwnerSchema], default: [] },
  },
  { timestamps: true }
);

donorRequestSchema.index({ phase: 1, nextExpansionAt: 1 });
donorRequestSchema.index({ phase: 1, createdAt: 1 });
donorRequestSchema.index({ searcher: 1, phase: 1 });
donorRequestSchema.index({ 'notifiedOwners.owner': 1 });

module.exports = mongoose.model('DonorRequest', donorRequestSchema);
