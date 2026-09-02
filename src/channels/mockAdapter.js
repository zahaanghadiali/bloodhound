const ChannelAdapter = require('./adapterInterface');
const logger = require('../utils/logger');

/**
 * Local/testing adapter — no external API involved. `normalizeIncoming`
 * expects the exact shape the /api/mock/incoming endpoint accepts:
 *   { externalUserId, text?, payload?, location? }
 * `send` just logs and lets the controller return the reply directly in the
 * HTTP response, since there's no real channel to push to yet.
 */
class MockAdapter extends ChannelAdapter {
  // eslint-disable-next-line class-methods-use-this
  normalizeIncoming(rawBody) {
    if (!rawBody || !rawBody.externalUserId) return null;
    return {
      channel: 'mock',
      externalUserId: String(rawBody.externalUserId),
      messageId: rawBody.messageId || `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: rawBody.text || '',
      payload: rawBody.payload || null,
      location: rawBody.location || null,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async send(externalUserId, message) {
    logger.info('mock send', { externalUserId, message });
  }
}

module.exports = new MockAdapter();
