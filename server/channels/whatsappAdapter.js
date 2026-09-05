const ChannelAdapter = require('./adapterInterface');
const { whatsapp } = require('../config/env');
const logger = require('../utils/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

// WhatsApp's own hard limits: a "button" message allows at most 3 quick-reply
// buttons; beyond that, Meta requires a "list" message instead (up to 10
// rows behind a single trigger button) — see buildOutgoingBody.
const MAX_BUTTONS = 3;
const MAX_LIST_ROWS = 10;

/**
 * Shapes one outbound message into the Graph API's request body. Plain text
 * when there are no options; a one-tap button message for up to 3 options
 * (the common case — quick yes/no, small menus); a list message for more
 * than that (e.g. the main menu, which has grown past 3 choices) — Meta
 * requires this shape instead of silently accepting >3 buttons, and a list
 * scales to real menus instead of quietly truncating them.
 */
function buildOutgoingBody(externalUserId, message) {
  const options = message.options || [];

  if (options.length === 0) {
    return { messaging_product: 'whatsapp', to: externalUserId, type: 'text', text: { body: message.text } };
  }

  if (options.length <= MAX_BUTTONS) {
    return {
      messaging_product: 'whatsapp',
      to: externalUserId,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message.text },
        action: {
          buttons: options.map((opt) => ({
            type: 'reply',
            reply: { id: String(opt.value), title: opt.label.slice(0, 20) },
          })),
        },
      },
    };
  }

  if (options.length > MAX_LIST_ROWS) {
    logger.warn('WhatsApp list message truncated to 10 rows', { externalUserId, optionCount: options.length });
  }

  return {
    messaging_product: 'whatsapp',
    to: externalUserId,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: message.text },
      action: {
        button: 'Choose an option',
        sections: [
          {
            rows: options.slice(0, MAX_LIST_ROWS).map((opt) => ({
              id: String(opt.value),
              title: opt.label.slice(0, 24),
            })),
          },
        ],
      },
    },
  };
}

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

    const body = buildOutgoingBody(externalUserId, message);

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
