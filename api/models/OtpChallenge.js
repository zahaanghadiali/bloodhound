const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * One pending (or most-recent) verification code per {conversation, field}.
 * Re-issuing a code overwrites the previous challenge for that field.
 */
const otpChallengeSchema = new Schema(
  {
    channel: { type: String, enum: ['whatsapp', 'instagram', 'mock'], required: true },
    externalUserId: { type: String, required: true },
    field: { type: String, enum: ['phone', 'email'], required: true },
    target: { type: String, required: true },
    codeHash: { type: String, required: true },
    salt: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date },
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

otpChallengeSchema.index({ channel: 1, externalUserId: 1, field: 1 }, { unique: true });

module.exports = mongoose.model('OtpChallenge', otpChallengeSchema);
