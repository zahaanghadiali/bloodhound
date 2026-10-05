const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const PetParent = require('../models/PetParent');
const otpService = require('../services/otpService');
const stepTypes = require('../engine/stepTypes');
const identityService = require('../services/identityService');
const { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } = require('../utils/jwt');

/**
 * Validates a phone number and canonicalizes it to its full international form.
 * @param {string} phone Phone number as typed by the user.
 * @return {{valid: boolean, value: (string|undefined), error:
 *     (string|undefined)}} The canonical number when valid, otherwise an error
 *     message.
 */

function normalizePhone(phone) {
  return stepTypes.validators.phone({ text: phone });
}

/**
 * Handles POST /api/auth/request-otp: sends a sign-in code to a phone number.
 * @param {Request} req Request whose JSON body has phone and externalUserId.
 * @return {Promise<Response>} JSON with the canonical phone and, with the mock
 *     provider, the code itself; 400 if externalUserId is missing or the phone
 *     is invalid.
 * @throws {Error} If the OTP provider fails to deliver the code.
 */
const requestOtp = apiHandler(async (req) => {
  const body = await req.json();
  const { phone, externalUserId } = body;

  if (!externalUserId) {
    return NextResponse.json({ error: 'externalUserId is required' }, { status: 400 });
  }

  const result = normalizePhone(phone);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { devCode } = await otpService.issueChallenge({
    channel: 'mock',
    externalUserId,
    field: 'phone',
    target: result.value,
  });

  return NextResponse.json({ ok: true, phone: result.value, devCode: devCode || null });
});

/**
 * Handles POST /api/auth/resend-otp: sends a fresh sign-in code.
 * @param {Request} req Request whose JSON body has phone and externalUserId.
 * @return {Promise<Response>} JSON confirming the resend; 400 for invalid
 *     input, 429 when the resend is refused.
 * @throws {Error} If the OTP provider fails to deliver the code.
 */
const resendOtp = apiHandler(async (req) => {
  const body = await req.json();
  const { phone, externalUserId } = body;
  if (!externalUserId) {
    return NextResponse.json({ error: 'externalUserId is required' }, { status: 400 });
  }
  const result = normalizePhone(phone);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const resendResult = await otpService.resend({ channel: 'mock', externalUserId, field: 'phone', target: result.value });
  if (!resendResult.ok) {
    return NextResponse.json({ error: resendResult.error }, { status: 429 });
  }
  return NextResponse.json({ ok: true, devCode: resendResult.devCode || null });
});

/**
 * Handles POST /api/auth/verify-otp: checks the code, resolves or creates the
 * pet parent for that phone number and starts a session.
 * @param {Request} req Request whose JSON body has phone, code and
 *     externalUserId.
 * @return {Promise<Response>} JSON with the parent and isNewAccount, plus the
 *     session cookie; 400 for invalid input or a wrong code.
 * @throws {Error} If JWT_SECRET is not set or a database operation fails.
 */
const verifyOtp = apiHandler(async (req) => {
  const body = await req.json();
  const { phone, code, externalUserId } = body;

  if (!externalUserId || !code) {
    return NextResponse.json({ error: 'externalUserId and code are required' }, { status: 400 });
  }
  const result = normalizePhone(phone);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const verified = await otpService.verifyCode({ channel: 'mock', externalUserId, field: 'phone', code });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const { parent: resolved, isNew: isNewAccount } = await identityService.resolveParentByPhone({
    channel: 'mock',
    externalUserId,
    phone: result.value,
  });
  const parent = await PetParent.findByIdAndUpdate(
    resolved._id,
    { $set: { phone: result.value, phoneVerifiedAt: verified.verifiedAt, deletedAt: null } },
    { new: true }
  );

  const token = signSession({ parentId: parent._id, phone: parent.phone, channel: 'mock', externalUserId });

  const response = NextResponse.json({ ok: true, parent, isNewAccount });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
});

/**
 * Handles POST /api/auth/logout: clears the session cookie.
 * @return {Promise<Response>} JSON confirming the sign-out.
 */
const logout = apiHandler(async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});

/**
 * Handles GET /api/auth/me: returns the pet parent for the current session.
 * @param {Request} req Request carrying the x-user-id header set by the proxy.
 * @return {Promise<Response>} JSON with the parent; 401 if the account no
 *     longer exists or was deleted.
 */
const me = apiHandler(async (req) => {
  const parentId = req.headers.get('x-user-id');
  const parent = await PetParent.findById(parentId);
  if (!parent || parent.deletedAt) return NextResponse.json({ error: 'Session no longer valid' }, { status: 401 });
  return NextResponse.json({ parent });
});

module.exports = { requestOtp, resendOtp, verifyOtp, logout, me };
