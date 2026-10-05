const mongoose = require('mongoose');

const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    channel: { type: String, enum: ['whatsapp', 'instagram', 'mock'], required: true },
    externalUserId: { type: String, required: true },
    flow: { type: String, enum: ['findDonor', 'registerDonor', null], default: null },
    currentStepId: { type: String, default: null },
    answers: { type: Map, of: Schema.Types.Mixed, default: {} },
    history: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
    consentAcceptedAt: { type: Date },
    lastMessageId: { type: String },
    petParent: { type: Schema.Types.ObjectId, ref: 'PetParent' },
    pendingAction: { type: String, default: null },
    pendingPetIds: { type: [Schema.Types.ObjectId], default: [] },
    pendingPhone: { type: String, default: null },
    pendingPurpose: { type: String, enum: ['upload', 'view', null], default: null },
    verifiedPhone: { type: String, default: null },
    phoneVerifiedForRecordsAt: { type: Date, default: null },
    pendingDonorRequests: {
      type: [{ requestId: { type: Schema.Types.ObjectId, ref: 'DonorRequest' } }],
      default: [],
    },
    pendingDonorAcceptRequestId: { type: Schema.Types.ObjectId, ref: 'DonorRequest', default: null },
    pendingUnlimitedConfirmRequestId: { type: Schema.Types.ObjectId, ref: 'DonorRequest', default: null },
    pendingListType: { type: String, enum: ['sentSearches', 'receivedRequests', null], default: null },
    pendingListOffset: { type: Number, default: 0 },
  },
  { timestamps: true }
);

conversationSchema.index({ channel: 1, externalUserId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
