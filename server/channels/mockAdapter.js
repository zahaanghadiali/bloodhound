const ChannelAdapter = require('./adapterInterface');
const logger = require('../utils/logger');

class MockAdapter extends ChannelAdapter {
  /**
   * Converts a body posted to /api/mock/incoming into the shared
   * incoming-message shape.
   * @param {?{externalUserId: string, messageId: (string|undefined), text:
   *     (string|undefined), payload: (string|undefined), location:
   *     (Object|undefined), attachment: (Object|undefined)}} rawBody Body sent
   *     by the website chat or a test client.
   * @return {?Object} The normalized message, or null when externalUserId is
   *     missing.
   */
  normalizeIncoming(rawBody) {
    if (!rawBody || !rawBody.externalUserId) return null;
    return {
      channel: 'mock',
      externalUserId: String(rawBody.externalUserId),
      messageId: rawBody.messageId || `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: rawBody.text || '',
      payload: rawBody.payload !== undefined ? rawBody.payload : null,
      location: rawBody.location || null,
      attachment: rawBody.attachment || null,
    };
  }

  /**
   * Logs the outbound message. There is no real channel to push to, so the
   * controller returns the reply in the HTTP response instead.
   * @param {string} externalUserId Id of the recipient.
   * @param {Object} message Outbound message.
   * @return {Promise<void>} Resolves once the message has been logged.
   */
  async send(externalUserId, message) {
    logger.info('mock send', { externalUserId, message });
  }
}

module.exports = new MockAdapter();
