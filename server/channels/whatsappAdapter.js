const ChannelAdapter = require('./adapterInterface');
const { whatsapp } = require('../config/env');
const logger = require('../utils/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

const MAX_BUTTONS = 3;
const MAX_LIST_ROWS = 10;
const MAX_BUTTON_TITLE = 20;
const MAX_ROW_TITLE = 24;

/**
 * Fits an option's label into one of WhatsApp's title length limits, preferring
 * its shortLabel and otherwise cutting it with an ellipsis.
 * @param {{label: string, shortLabel: (string|undefined)}} opt Reply option.
 * @param {number} max Maximum title length in characters.
 * @return {string} A title no longer than max.
 */
function fitTitle(opt, max) {
  if (opt.label.length <= max) return opt.label;
  const title = opt.shortLabel || opt.label;
  return title.length <= max ? title : `${title.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Builds the grey second line of a list row: the option's own description, or
 * its full label when the title had to be shortened.
 * @param {{label: string, description: (string|undefined)}} opt Reply option.
 * @return {{description: (string|undefined)}} Object to spread into the row;
 *     empty when there is nothing to show.
 */
function rowDescription(opt) {
  const description = opt.description || (opt.label.length > MAX_ROW_TITLE ? opt.label : '');
  return description ? { description: description.slice(0, 72) } : {};
}

const INLINE_IMAGE_TYPES = ['image/jpeg', 'image/png'];

/**
 * Shapes one outbound message into a Graph API request body: a media message
 * when the reply carries a file link, plain text when there are no options, a
 * button message for up to 3 options, and a list message (truncated to 10 rows)
 * for more or when optionsStyle is 'list'.
 * @param {string} externalUserId WhatsApp number of the recipient.
 * @param {Object} message Outbound message with text and optional options,
 *     optionsStyle, listButton or media.
 * @return {Object} Request body for the Graph API messages endpoint.
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

/**
 * Posts a message body to the WhatsApp Cloud API, logging a failed response.
 * @param {Object} body Request body built by buildOutgoingBody.
 * @return {Promise<boolean>} True if the API accepted the message.
 * @throws {Error} If the network request itself fails.
 */
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
 * Downloads an inbound photo or file and converts it into the attachment shape
 * the website chat sends. The media id is first resolved to a short-lived URL,
 * which is then fetched with the access token.
 * @param {?{id: string, mime_type: (string|undefined), filename:
 *     (string|undefined)}} media Media object from the webhook message.
 * @param {string} messageId Id of the message, used to name unnamed photos.
 * @return {Promise<?{type: string, dataUrl: string, mimeType: string, filename:
 *     string, sizeBytes: number}>} The attachment, or null when there is no
 *     media, no access token, or either request fails (the failure is logged).
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

class WhatsAppAdapter extends ChannelAdapter {
  /**
   * Converts a WhatsApp Cloud API webhook body into the shared incoming-message
   * shape, downloading any attached photo or document.
   * @param {Object} rawBody Raw webhook body from Meta.
   * @return {Promise<?Object>} The normalized message, or null when the body is
   *     not a user message (for example a status or delivery-receipt callback).
   */
  async normalizeIncoming(rawBody) {
    const change = rawBody?.entry?.[0]?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return null;

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
      base.attachment = await downloadAttachment(message[message.type], message.id);
    }
    return base;
  }

  /**
   * Sends a message through the WhatsApp Cloud API. If Meta refuses a file as
   * media, it is resent as a plain link. Skipped with a warning when
   * credentials are not configured.
   * @param {string} externalUserId WhatsApp number of the recipient.
   * @param {Object} message Outbound message with text and optional options or
   *     media.
   * @return {Promise<void>} Resolves once the message has been sent or skipped.
   * @throws {Error} If the network request itself fails.
   */
  async send(externalUserId, message) {
    if (!whatsapp.accessToken || !whatsapp.phoneNumberId) {
      logger.warn('WhatsApp send skipped: no credentials configured yet', { externalUserId, message });
      return;
    }

    const sent = await postMessage(buildOutgoingBody(externalUserId, message));

    if (!sent && message.media?.url) {
      await postMessage(
        buildOutgoingBody(externalUserId, { text: `${message.text}\n${message.media.url}` })
      );
    }
  }
}

module.exports = new WhatsAppAdapter();
