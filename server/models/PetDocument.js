const mongoose = require('mongoose');

const { Schema } = mongoose;

const petDocumentSchema = new Schema(
  {
    pet: { type: Schema.Types.ObjectId, ref: 'Pet', required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'PetParent', required: true },
    filename: { type: String, trim: true, required: true },
    mimeType: { type: String, trim: true, required: true },
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
