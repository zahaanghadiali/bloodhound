const crypto = require('crypto');
const OtpChallenge = require('../models/OtpChallenge');
const { otp: otpConfig } = require('../config/env');
const { getSmsProvider, getEmailProvider, mockOtpProvider } = require('../otp/otpProviderFactory');

const CODE_TTL_MS = otpConfig.codeTtlMinutes * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code, salt) {
  return crypto.createHmac('sha256', otpConfig.hashSecret).update(`${salt}:${code}`).digest('hex');
}

/** Sends the code via the field's provider; returns the code back out only when that provider is the mock one, for dev-mode display. */
async function dispatch(field, target, code) {
  const provider = field === 'phone' ? getSmsProvider() : getEmailProvider();
  await provider.send(target, code);
  return provider === mockOtpProvider ? code : null;
}

/** Issues a fresh code for {channel, externalUserId, field}, replacing any previous pending challenge. */
async function issueChallenge({ channel, externalUserId, field, target }) {
  const salt = crypto.randomBytes(8).toString('hex');
  const code = generateCode();
  const codeHash = hashCode(code, salt);
  const now = new Date();

  await OtpChallenge.findOneAndUpdate(
    { channel, externalUserId, field },
    {
      $set: {
        target,
        codeHash,
        salt,
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
        lastSentAt: now,
        attempts: 0,
        verifiedAt: null,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const devCode = await dispatch(field, target, code);
  return { devCode };
}

/** Re-sends a code, rate-limited so a user (or a stuck retry loop) can't spam the provider. */
async function resend({ channel, externalUserId, field, target }) {
  const existing = await OtpChallenge.findOne({ channel, externalUserId, field });
  if (existing?.lastSentAt && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: 'Please wait a few seconds before requesting another code.' };
  }
  const { devCode } = await issueChallenge({ channel, externalUserId, field, target });
  return { ok: true, devCode };
}

async function verifyCode({ channel, externalUserId, field, code }) {
  const challenge = await OtpChallenge.findOne({ channel, externalUserId, field });
  if (!challenge || challenge.verifiedAt) {
    return { ok: false, error: 'No code is pending — type "back" to re-enter and try again.' };
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'That code expired. Type "resend" to get a new one.' };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many incorrect attempts. Type "resend" to get a new code.' };
  }

  const candidateHash = hashCode(code, challenge.salt);
  if (candidateHash !== challenge.codeHash) {
    challenge.attempts += 1;
    await challenge.save();
    const remaining = MAX_ATTEMPTS - challenge.attempts;
    return { ok: false, error: `That code doesn't match. ${remaining} attempt${remaining === 1 ? '' : 's'} left.` };
  }

  challenge.verifiedAt = new Date();
  await challenge.save();
  return { ok: true, verifiedAt: challenge.verifiedAt };
}

module.exports = { issueChallenge, resend, verifyCode };
