const crypto = require('crypto');
const { NextResponse } = require('next/server');
const { getAdapter } = require('../channels/adapterFactory');
const messageProcessor = require('../services/messageProcessor');
const { connectDb } = require('../config/db');
const { whatsapp, instagram } = require('../config/env');
const logger = require('../utils/logger');

const VERIFY_TOKENS = { whatsapp: whatsapp.verifyToken, instagram: instagram.verifyToken };
const APP_SECRETS = { whatsapp: whatsapp.appSecret, instagram: instagram.appSecret };

/**
 * Validates Meta's X-Hub-Signature-256 header against the channel's app secret.
 * @param {string} channel Channel name: 'whatsapp' or 'instagram'.
 * @param {?string} signature Value of the signature header.
 * @param {string} rawBody Raw, unparsed request body.
 * @return {boolean} True if the signature matches, or if no app secret is
 *     configured for the channel yet.
 */
function isValidSignature(channel, signature, rawBody) {
  const secret = APP_SECRETS[channel];
  if (!secret) return true;
  if (!signature) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Creates the handler for Meta's webhook subscription handshake.
 * @param {string} channel Channel name: 'whatsapp' or 'instagram'.
 * @return {function(Request): Promise<Response>} Handler that echoes
 *     hub.challenge when the verify token matches and responds 403 otherwise.
 */
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
 * Creates the inbound message webhook handler. It normalizes the body through
 * the channel adapter, runs it through the flow engine and sends the replies
 * back out, finishing all processing before it responds.
 * @param {string} channel Channel name: 'whatsapp' or 'instagram'.
 * @return {function(Request): Promise<Response>} Handler that responds 401 for
 *     a bad signature and 200 otherwise; processing errors are logged, not
 *     thrown.
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
      const normalized = await adapter.normalizeIncoming(body);
      if (normalized) {
        const replies = await messageProcessor.handle(normalized);
        for (const message of replies) {
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
