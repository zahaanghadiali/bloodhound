const mongoose = require('mongoose');

const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
  { _id: false }
);

/**
 * One notified donor account for a DonorRequest. Kept at the account level
 * (not per-pet) so a donor with several eligible pets picks which one
 * actually donates at accept time, rather than the radius search locking
 * them to whichever pet happened to match the geo query.
 */
const notifiedOwnerSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'PetParent', required: true },
    // 'expired': never answered within 30 days of being asked — see
    // donorRequestService.expireStaleRequests. No longer actionable.
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired'], default: 'pending' },
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', default: null }, // set once accepted
    notifiedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * One in-flight "find a blood donor" search. Donors are asked in an
 * expanding radius (see donorRequestService) rather than being revealed to
 * the searcher directly — notifiedOwners tracks who's already been asked
 * (and how they responded) so nobody gets asked twice as the radius grows.
 */
const donorRequestSchema = new Schema(
  {
    searcher: { type: Schema.Types.ObjectId, ref: 'PetParent', required: true },
    species: { type: String, enum: ['dog', 'cat'], required: true },
    // 'radius': location is a real Point, expands over time up to maxRadiusKm.
    // 'text': a plain typed city/area name with no pin — matched against
    // donors' own locationText instead of distance, for sharing with people
    // who haven't (or can't) share a precise location. No radius to expand.
    searchMode: { type: String, enum: ['radius', 'text'], required: true, default: 'radius' },
    location: { type: pointSchema, default: undefined },
    locationText: { type: String, trim: true },
    maxRadiusKm: { type: Number, default: null },
    currentRadiusKm: { type: Number, default: null },
    // 'expired': still open 30 days after being created with no resolution
    // — see donorRequestService.expireStaleRequests. Distinct from
    // 'stopped', which means the searcher ended it themselves.
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
