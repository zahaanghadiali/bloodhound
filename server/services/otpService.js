const crypto = require('crypto');
const OtpChallenge = require('../models/OtpChallenge');
const { otp: otpConfig } = require('../config/env');
const { getSmsProvider, getEmailProvider, mockOtpProvider } = require('../otp/otpProviderFactory');

const CODE_TTL_MS = otpConfig.codeTtlMinutes * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Generates a random 6-digit verification code.
 * @return {string} The code, zero-padded to 6 digits.
 */
function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Hashes a verification code for storage.
 * @param {string} code Verification code.
 * @param {string} salt Per-challenge salt.
 * @return {string} Hex HMAC-SHA256 of the salted code.
 */
function hashCode(code, salt) {
  return crypto.createHmac('sha256', otpConfig.hashSecret).update(`${salt}:${code}`).digest('hex');
}

/**
 * Sends a code through the provider for the field.
 * @param {string} field 'phone' for SMS, anything else for email.
 * @param {string} target Phone number or email address.
 * @param {string} code Verification code.
 * @return {Promise<?string>} The code itself when the mock provider is in use
 *     (for dev-mode display), otherwise null.
 * @throws {Error} If the provider fails to deliver the code.
 */
async function dispatch(field, target, code) {
  const provider = field === 'phone' ? getSmsProvider() : getEmailProvider();
  await provider.send(target, code);
  return provider === mockOtpProvider ? code : null;
}

/**
 * Issues a fresh code for a user and field, replacing any previous pending
 * challenge.
 * @param {{channel: string, externalUserId: string, field: string, target:
 *     string}} challenge Who is verifying, which field ('phone' or 'email') and
 *     where to send the code.
 * @return {Promise<{devCode: ?string}>} The code when the mock provider is in
 *     use, otherwise null.
 * @throws {Error} If the provider fails to deliver the code.
 */
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

/**
 * Re-sends a code, rate-limited to one every 30 seconds.
 * @param {{channel: string, externalUserId: string, field: string, target:
 *     string}} challenge Who is verifying, which field and where to send the
 *     code.
 * @return {Promise<{ok: boolean, devCode: (?string|undefined), error:
 *     (string|undefined)}>} ok with the dev code, or an error when requested
 *     too soon.
 * @throws {Error} If the provider fails to deliver the code.
 */
async function resend({ channel, externalUserId, field, target }) {
  const existing = await OtpChallenge.findOne({ channel, externalUserId, field });
  if (existing?.lastSentAt && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: 'Please wait a few seconds before requesting another code.' };
  }
  const { devCode } = await issueChallenge({ channel, externalUserId, field, target });
  return { ok: true, devCode };
}

/**
 * Checks a submitted code against the pending challenge, allowing at most 5
 * wrong attempts.
 * @param {{channel: string, externalUserId: string, field: string, code:
 *     string}} attempt Who is verifying, which field and the submitted code.
 * @return {Promise<{ok: boolean, verifiedAt: (Date|undefined), error:
 *     (string|undefined)}>} ok with the verification time, or an error when no
 *     code is pending or the code is expired, exhausted or wrong.
 */
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
