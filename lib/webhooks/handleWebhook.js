const crypto = require('crypto');
const { NextResponse } = require('next/server');
const { getAdapter } = require('../channels/adapterFactory');
const messageProcessor = require('../services/messageProcessor');
const { connectDb } = require('../config/db');
const { whatsapp, instagram } = require('../config/env');
const logger = require('../utils/logger');

const VERIFY_TOKENS = { whatsapp: whatsapp.verifyToken, instagram: instagram.verifyToken };
const APP_SECRETS = { whatsapp: whatsapp.appSecret, instagram: instagram.appSecret };

/** Validates Meta's X-Hub-Signature-256 header against the app secret. No-ops until configured. */
function isValidSignature(channel, signature, rawBody) {
  const secret = APP_SECRETS[channel];
  if (!secret) return true;
  if (!signature) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false; // length mismatch etc.
  }
}

/** Meta's webhook subscription handshake (GET with hub.mode/hub.verify_token/hub.challenge). */
function verifyWebhook(channel) {
  return async (req) => {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
    const expected = VERIFY_TOKENS[channel];

    if (mode === 'subscribe' && expected && token === expected) {
      return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
  };
}

/**
 * Inbound message webhook. Normalizes via the channel adapter, runs it
 * through the flow engine, and pushes any replies back out via the same
 * adapter.
 *
 * Unlike the original Express version, this awaits processing fully before
 * responding: serverless functions can be frozen/torn down the instant a
 * response is sent, so "ack 200 then keep working" isn't safe on Vercel.
 * Processing here is just DB reads/writes, so it stays well within Meta's
 * webhook response window.
 */
function receiveWebhook(channel) {
  return async (req) => {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    if (!isValidSignature(channel, signature, rawBody)) {
      return new NextResponse(null, { status: 401 });
    }

    try {
      await connectDb();
      const body = rawBody ? JSON.parse(rawBody) : {};
      const adapter = getAdapter(channel);
      const normalized = adapter.normalizeIncoming(body);
      if (normalized) {
        const replies = await messageProcessor.handle(normalized);
        for (const message of replies) {
          // eslint-disable-next-line no-await-in-loop
          await adapter.send(normalized.externalUserId, message);
        }
      }
    } catch (err) {
      logger.error(`Webhook processing failed for ${channel}`, { error: err.message });
    }

    return new NextResponse(null, { status: 200 });
  };
}

module.exports = { verifyWebhook, receiveWebhook };
