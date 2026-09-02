const mongoose = require('mongoose');

const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    channel: { type: String, enum: ['whatsapp', 'instagram', 'mock'], required: true },
    externalUserId: { type: String, required: true },
    flow: { type: String, enum: ['findDonor', 'registerDonor', null], default: null },
    currentStepId: { type: String, default: null },
    answers: { type: Map, of: Schema.Types.Mixed, default: {} },
    history: { type: [String], default: [] }, // stack of previous stepIds, for "back"
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
    consentAcceptedAt: { type: Date },
    lastMessageId: { type: String }, // for webhook delivery dedupe
    petParent: { type: Schema.Types.ObjectId, ref: 'PetParent' },
    // Set while a global command needs a follow-up reply outside the normal flow
    // (e.g. "pause" asking which of several pets to pause).
    pendingAction: { type: String, default: null },
    pendingPetIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

conversationSchema.index({ channel: 1, externalUserId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
