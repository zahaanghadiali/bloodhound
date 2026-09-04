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
    // Phone number being OTP-verified for the "upload/view medical
    // records" flows, and which of those two the verification is for —
    // pets can be registered from a different session than the one asking
    // to see them, so those flows re-identify the owner by phone rather
    // than trusting the current session's own donor profile.
    pendingPhone: { type: String, default: null },
    pendingPurpose: { type: String, enum: ['upload', 'view', null], default: null },
    // Once a phone number is OTP-verified for the medical-records flows on
    // this device/session, remembered here so the same device isn't asked
    // again until RECORDS_VERIFICATION_TTL_DAYS passes (see messageProcessor's
    // isRecordsVerificationFresh). Unrelated to `pendingPhone` above, which
    // only holds a number mid-verification.
    verifiedPhone: { type: String, default: null },
    phoneVerifiedForRecordsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conversationSchema.index({ channel: 1, externalUserId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
