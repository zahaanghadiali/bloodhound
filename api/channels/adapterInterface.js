/**
 * Contract every channel adapter must implement. WhatsApp, Instagram, and the
 * mock adapter all normalize into/out of this shape so the FlowEngine and
 * messageProcessor never need to know which channel they're talking to.
 *
 * normalizeIncoming(rawBody) -> {
 *   channel: 'whatsapp' | 'instagram' | 'mock',
 *   externalUserId: string,
 *   messageId: string,
 *   text: string,
 *   payload: string | null,       // button/list reply id, if any
 *   location: { lat, lng, label? } | null,
 * } | null   (null when the payload isn't a user message, e.g. a delivery receipt)
 *
 * send(externalUserId, message) -> Promise<void>
 *   message: { text: string, options?: [{ value, label }] }
 */

class ChannelAdapter {
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  normalizeIncoming(rawBody) {
    throw new Error('normalizeIncoming() not implemented');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async send(externalUserId, message) {
    throw new Error('send() not implemented');
  }
}

module.exports = ChannelAdapter;
