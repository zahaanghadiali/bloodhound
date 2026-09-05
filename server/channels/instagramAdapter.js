const ChannelAdapter = require('./adapterInterface');
const { instagram } = require('../config/env');
const logger = require('../utils/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

/**
 * Instagram Messaging API adapter (Graph API "messaging" webhook shape).
 * https://developers.facebook.com/docs/messenger-platform/instagram
 */
class InstagramAdapter extends ChannelAdapter {
  // eslint-disable-next-line class-methods-use-this
  normalizeIncoming(rawBody) {
    const messaging = rawBody?.entry?.[0]?.messaging?.[0];
    if (!messaging?.message) return null;

    return {
      channel: 'instagram',
      externalUserId: messaging.sender?.id,
      messageId: messaging.message.mid,
      text: messaging.message.text || '',
      payload: messaging.message.quick_reply?.payload || null,
      location: null, // Instagram messaging has no native location share; users type it
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async send(externalUserId, message) {
    if (!instagram.accessToken) {
      logger.warn('Instagram send skipped: no credentials configured yet', { externalUserId, message });
      return;
    }

    const body = {
      recipient: { id: externalUserId },
      message: message.options?.length
        ? {
            text: message.text,
            quick_replies: message.options.slice(0, 13).map((opt) => ({
              content_type: 'text',
              title: opt.label.slice(0, 20),
              payload: String(opt.value),
            })),
          }
        : { text: message.text },
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
