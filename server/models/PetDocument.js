const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * One uploaded medical record. Its own collection rather than an array on
 * the Pet, so a pet with many files doesn't bloat every read of the pet
 * itself. `owner` is denormalized from the pet so one parent's files can be
 * found without going through their pets first.
 */
const petDocumentSchema = new Schema(
  {
    pet: { type: Schema.Types.ObjectId, ref: 'Pet', required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'PetParent', required: true },
    filename: { type: String, trim: true, required: true },
    mimeType: { type: String, trim: true, required: true },
    // Exactly one of these is set: `storageKey` for a real storage
    // provider (S3) — the URL is generated on demand and never
    // persisted — or `url` directly for the inline (data URL) provider.
    storageKey: { type: String },
    url: { type: String },
    sizeBytes: { type: Number },
    status: { type: String, enum: ['verified', 'pending'], default: 'pending' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'documents' }
);

petDocumentSchema.index({ pet: 1, uploadedAt: 1 });
petDocumentSchema.index({ owner: 1 });

module.exports = mongoose.model('PetDocument', petDocumentSchema);
