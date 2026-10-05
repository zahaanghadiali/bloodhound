const ChannelAdapter = require('./adapterInterface');
const { instagram } = require('../config/env');
const logger = require('../utils/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

class InstagramAdapter extends ChannelAdapter {
  /**
   * Converts an Instagram Messaging webhook body into the shared
   * incoming-message shape.
   * @param {Object} rawBody Raw Graph API "messaging" webhook body.
   * @return {?Object} The normalized message, or null when the body carries no
   *     user message. Location is always null because Instagram has no native
   *     location share.
   */
  normalizeIncoming(rawBody) {
    const messaging = rawBody?.entry?.[0]?.messaging?.[0];
    if (!messaging?.message) return null;

    return {
      channel: 'instagram',
      externalUserId: messaging.sender?.id,
      messageId: messaging.message.mid,
      text: messaging.message.text || '',
      payload: messaging.message.quick_reply?.payload || null,
      location: null,
    };
  }

  /**
   * Sends a message through the Instagram Messaging API. Options become quick
   * replies (at most 13) and a file is sent as its link. Skipped with a warning
   * when no access token is configured; a failed request is logged, not thrown.
   * @param {string} externalUserId Instagram-scoped id of the recipient.
   * @param {Object} message Outbound message with text and optional options or
   *     media.
   * @return {Promise<void>} Resolves once the request has completed.
   */
  async send(externalUserId, message) {
    if (!instagram.accessToken) {
      logger.warn('Instagram send skipped: no credentials configured yet', { externalUserId, message });
      return;
    }

    const text = message.media?.url ? `${message.text}\n${message.media.url}` : message.text;

    const body = {
      recipient: { id: externalUserId },
      message: message.options?.length
        ? {
            text,
            quick_replies: message.options.slice(0, 13).map((opt) => ({
              content_type: 'text',
              title: (opt.label.length > 20 && opt.shortLabel ? opt.shortLabel : opt.label).slice(0, 20),
              payload: String(opt.value),
            })),
          }
        : { text },
    };

    const res = await fetch(`${GRAPH_API_BASE}/me/messages?access_token=${instagram.accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.error('Instagram send failed', { status: res.status, body: await res.text() });
    }
  }
}

module.exports = new InstagramAdapter();
