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
    // Donor-side: a queue of outstanding "can you help?" asks (one owner can
    // be asked about several different in-flight DonorRequests at once).
    // Which pet answers is picked at accept time, not baked into the queue.
    pendingDonorRequests: {
      type: [{ requestId: { type: Schema.Types.ObjectId, ref: 'DonorRequest' } }],
      default: [],
    },
    // Set while resolveDonorRequestResponse is waiting on "which pet is
    // donating?" after an accept, for an owner with more than one eligible pet.
    pendingDonorAcceptRequestId: { type: Schema.Types.ObjectId, ref: 'DonorRequest', default: null },
    // Searcher-side: set once their search hits maxRadiusKm with no
    // accepts, asking whether to widen to an unlimited radius.
    pendingUnlimitedConfirmRequestId: { type: Schema.Types.ObjectId, ref: 'DonorRequest', default: null },
    // "My searches" / "My requests" are paginated 2 at a time (button
    // limits on WhatsApp/Instagram) — remembers where the next "Load more"
    // tap should resume from, and which list it's paging through.
    pendingListType: { type: String, enum: ['sentSearches', 'receivedRequests', null], default: null },
    pendingListOffset: { type: Number, default: 0 },
  },
  { timestamps: true }
);

conversationSchema.index({ channel: 1, externalUserId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
