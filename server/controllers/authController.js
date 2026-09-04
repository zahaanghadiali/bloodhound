const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const PetParent = require('../models/PetParent');
const otpService = require('../services/otpService');
const stepTypes = require('../engine/stepTypes');

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

  const existing = await PetParent.findOne({ channel: 'mock', externalUserId });
  const isNewAccount = !existing;

  const parent = await PetParent.findOneAndUpdate(
    { channel: 'mock', externalUserId },
    { $set: { phone: result.value, phoneVerifiedAt: verified.verifiedAt, deletedAt: null } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({ ok: true, parent, isNewAccount });
});

module.exports = { requestOtp, resendOtp, verifyOtp };
