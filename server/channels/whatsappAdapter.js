const ChannelAdapter = require('./adapterInterface');
const { whatsapp } = require('../config/env');
const logger = require('../utils/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

// WhatsApp's own hard limits: a "button" message allows at most 3 quick-reply
// buttons; beyond that, Meta requires a "list" message instead (up to 10
// rows behind a single trigger button) — see buildOutgoingBody.
const MAX_BUTTONS = 3;
const MAX_LIST_ROWS = 10;
const MAX_BUTTON_TITLE = 20;
const MAX_ROW_TITLE = 24;

/**
 * Fits an option's label into one of WhatsApp's title limits: its own
 * `shortLabel` if the full label is too long, and failing that a cut with
 * an ellipsis rather than a word chopped off mid-way.
 */
function fitTitle(opt, max) {
  if (opt.label.length <= max) return opt.label;
  const title = opt.shortLabel || opt.label;
  return title.length <= max ? title : `${title.slice(0, max - 1).trimEnd()}…`;
}

/** A list row's grey second line: the option's own description, or its full label when the title had to be shortened. */
function rowDescription(opt) {
  const description = opt.description || (opt.label.length > MAX_ROW_TITLE ? opt.label : '');
  return description ? { description: description.slice(0, 72) } : {};
}

// Mime types WhatsApp will render inline as a photo; every other file goes
// out as a "document" message (which is what opens PDFs/DOCX in-app).
const INLINE_IMAGE_TYPES = ['image/jpeg', 'image/png'];

/**
 * Shapes one outbound message into the Graph API's request body. A media
 * message when the reply carries a file link (Meta fetches the link itself
 * at send time, so a short-lived signed S3 URL is fine); plain text when
 * there are no options; a one-tap button message for up to 3 options (the
 * common case — quick yes/no, small menus); a list message for more than
 * that (e.g. the main menu, which has grown past 3 choices) or whenever the
 * reply asks for one via `optionsStyle: 'list'` — Meta requires this shape
 * instead of silently accepting >3 buttons, and a list scales to real menus
 * instead of quietly truncating them.
 */
function buildOutgoingBody(externalUserId, message) {
  const options = message.options || [];

  if (message.media?.url) {
    const { url, filename, mimeType } = message.media;
    const media = INLINE_IMAGE_TYPES.includes(mimeType)
      ? { type: 'image', image: { link: url, caption: message.text } }
      : { type: 'document', document: { link: url, filename, caption: message.text } };
    return { messaging_product: 'whatsapp', to: externalUserId, ...media };
  }

  if (options.length === 0) {
    return { messaging_product: 'whatsapp', to: externalUserId, type: 'text', text: { body: message.text } };
  }

  if (options.length <= MAX_BUTTONS && message.optionsStyle !== 'list') {
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
            reply: { id: String(opt.value), title: fitTitle(opt, MAX_BUTTON_TITLE) },
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
        button: (message.listButton || 'Choose an option').slice(0, 20),
        sections: [
          {
            rows: options.slice(0, MAX_LIST_ROWS).map((opt) => ({
              id: String(opt.value),
              title: fitTitle(opt, MAX_ROW_TITLE),
              ...rowDescription(opt),
            })),
          },
        ],
      },
    },
  };
}

async function postMessage(body) {
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
  return res.ok;
}

const EXTENSION_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Turns an inbound photo/file into the same `attachment` shape the website
 * chat sends. A webhook only carries a media id, so the bytes are fetched
 * in two hops: the id resolves to a short-lived download URL, which itself
 * needs the access token. Returns null (logged) if either hop fails, so the
 * flow just re-asks instead of the whole webhook erroring out.
 */
async function downloadAttachment(media, messageId) {
  if (!media?.id || !whatsapp.accessToken) return null;
  const headers = { Authorization: `Bearer ${whatsapp.accessToken}` };

  try {
    const metaRes = await fetch(`${GRAPH_API_BASE}/${media.id}`, { headers });
    if (!metaRes.ok) throw new Error(`media lookup ${metaRes.status}: ${await metaRes.text()}`);
    const meta = await metaRes.json();

    const fileRes = await fetch(meta.url, { headers });
    if (!fileRes.ok) throw new Error(`media download ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    // "image/jpeg; codecs=..." style suffixes would break the data URL.
    const mimeType = String(media.mime_type || meta.mime_type || 'application/octet-stream').split(';')[0].trim();
    return {
      type: mimeType.startsWith('image/') ? 'image' : 'file',
      dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
      mimeType,
      filename: media.filename || `photo-${messageId.slice(-8)}.${EXTENSION_BY_MIME[mimeType] || 'jpg'}`,
      sizeBytes: buffer.length,
    };
  } catch (err) {
    logger.error('WhatsApp media download failed', { mediaId: media.id, error: err.message });
    return null;
  }
}

/**
 * WhatsApp Cloud API adapter. Written against Meta's real webhook payload
 * shape so wiring it up later is just filling in .env — no code changes.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */
class WhatsAppAdapter extends ChannelAdapter {
  // Async, unlike the other adapters: photos/files have to be downloaded.
  // eslint-disable-next-line class-methods-use-this
  async normalizeIncoming(rawBody) {
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
      attachment: null,
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
    } else if (message.type === 'image' || message.type === 'document') {
      // A photo sent from the gallery/camera arrives as "image"; the same
      // photo (or a PDF/DOCX) sent via "Document" arrives as "document".
      base.attachment = await downloadAttachment(message[message.type], message.id);
    }
    return base;
  }

  // eslint-disable-next-line class-methods-use-this
  async send(externalUserId, message) {
    if (!whatsapp.accessToken || !whatsapp.phoneNumberId) {
      logger.warn('WhatsApp send skipped: no credentials configured yet', { externalUserId, message });
      return;
    }

    const sent = await postMessage(buildOutgoingBody(externalUserId, message));

    // A file Meta refused to deliver as media (unsupported type, too big)
    // still shouldn't be a dead end — fall back to the plain link.
    if (!sent && message.media?.url) {
      await postMessage(
        buildOutgoingBody(externalUserId, { text: `${message.text}\n${message.media.url}` })
      );
    }
  }
}

module.exports = new WhatsAppAdapter();
