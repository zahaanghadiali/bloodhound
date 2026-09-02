const crypto = require('crypto');
const { getAdapter } = require('../channels/adapterFactory');
const messageProcessor = require('../services/messageProcessor');
const { whatsapp, instagram } = require('../config/env');
const logger = require('../utils/logger');

const VERIFY_TOKENS = { whatsapp: whatsapp.verifyToken, instagram: instagram.verifyToken };
const APP_SECRETS = { whatsapp: whatsapp.appSecret, instagram: instagram.appSecret };

/**
 * Validates Meta's X-Hub-Signature-256 header against the app secret.
 * No-ops (passes) until an app secret is configured, since we don't have
 * one yet — this becomes a real check the moment .env is filled in.
 */
function isValidSignature(channel, req) {
  const secret = APP_SECRETS[channel];
  if (!secret) return true;
  const signature = req.get('x-hub-signature-256');
  if (!signature) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody || '').digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/** Meta's webhook subscription handshake (GET with hub.mode/hub.verify_token/hub.challenge). */
function verify(channel) {
  return (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expected = VERIFY_TOKENS[channel];

    if (mode === 'subscribe' && expected && token === expected) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  };
}

/**
 * Inbound message webhook. Normalizes via the channel adapter, runs it
 * through the flow engine, and pushes any replies back out via the same
 * adapter. Always ACKs 200 quickly so Meta doesn't retry/backoff on us.
 */
function receive(channel) {
  return async (req, res) => {
    if (!isValidSignature(channel, req)) {
      return res.sendStatus(401);
    }
    res.sendStatus(200); // ack immediately; processing continues below

    try {
      const adapter = getAdapter(channel);
      const normalized = adapter.normalizeIncoming(req.body);
      if (!normalized) return; // e.g. a delivery/read receipt, not a user message

      const replies = await messageProcessor.handle(normalized);
      for (const message of replies) {
        // eslint-disable-next-line no-await-in-loop
        await adapter.send(normalized.externalUserId, message);
      }
    } catch (err) {
      logger.error(`Webhook processing failed for ${channel}`, { error: err.message });
    }
  };
}

module.exports = { verify, receive };
