const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const PetParent = require('../models/PetParent');
const otpService = require('../services/otpService');
const stepTypes = require('../engine/stepTypes');
const identityService = require('../services/identityService');
const { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } = require('../utils/jwt');

/**
 * Phone + OTP sign-in/sign-up for the web app itself — the "precursor"
 * gate in front of AppShell. Reuses the same OTP infra (mock provider
 * today, Twilio later via OTP_SMS_PROVIDER) and PetParent model the chat's
 * registerDonor flow already uses, keyed by {channel: 'mock',
 * externalUserId}, so an account created here is the same account the
 * chat bot sees for this device.
 */

function normalizePhone(phone) {
  return stepTypes.validators.phone({ text: phone });
}

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

const logout = apiHandler(async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});

/** GET /api/auth/me — the authenticated PetParent for the current session (proxy.js has already verified the JWT). */
const me = apiHandler(async (req) => {
  const parentId = req.headers.get('x-user-id');
  const parent = await PetParent.findById(parentId);
  if (!parent || parent.deletedAt) return NextResponse.json({ error: 'Session no longer valid' }, { status: 401 });
  return NextResponse.json({ parent });
});

module.exports = { requestOtp, resendOtp, verifyOtp, logout, me };
