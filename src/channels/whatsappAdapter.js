const ChannelAdapter = require('./adapterInterface');
const { whatsapp } = require('../config/env');
const logger = require('../utils/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

/**
 * WhatsApp Cloud API adapter. Written against Meta's real webhook payload
 * shape so wiring it up later is just filling in .env — no code changes.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */
class WhatsAppAdapter extends ChannelAdapter {
  // eslint-disable-next-line class-methods-use-this
  normalizeIncoming(rawBody) {
    const change = rawBody?.entry?.[0]?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return null; // e.g. a status/delivery-receipt callback, not a user message

    const base = {
      channel: 'whatsapp',
      externalUserId: message.from,
      messageId: message.id,
      text: '',
      payload: null,
      location: null,
    };

    if (message.type === 'text') {
      base.text = message.text?.body || '';
    } else if (message.type === 'interactive') {
      const interactive = message.interactive;
      base.payload = interactive?.button_reply?.id || interactive?.list_reply?.id || null;
      base.text = interactive?.button_reply?.title || interactive?.list_reply?.title || '';
    } else if (message.type === 'location') {
      base.location = {
        lat: message.location.latitude,
        lng: message.location.longitude,
        label: message.location.name || null,
      };
    }
    return base;
  }

  // eslint-disable-next-line class-methods-use-this
  async send(externalUserId, message) {
    if (!whatsapp.accessToken || !whatsapp.phoneNumberId) {
      logger.warn('WhatsApp send skipped: no credentials configured yet', { externalUserId, message });
      return;
    }

    const body = message.options?.length
      ? {
          messaging_product: 'whatsapp',
          to: externalUserId,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: message.text },
            action: {
              buttons: message.options.slice(0, 3).map((opt) => ({
                type: 'reply',
                reply: { id: opt.value, title: opt.label.slice(0, 20) },
              })),
            },
          },
        }
      : { messaging_product: 'whatsapp', to: externalUserId, type: 'text', text: { body: message.text } };

    const res = await fetch(`${GRAPH_API_BASE}/${whatsapp.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.error('WhatsApp send failed', { status: res.status, body: await res.text() });
    }
  }
}

module.exports = new WhatsAppAdapter();
