class ChannelAdapter {
  /**
   * Converts a channel's raw webhook body into the shared incoming-message
   * shape, so the flow engine never needs to know which channel it is talking
   * to.
   * @param {Object} rawBody Raw request body received from the channel.
   * @return {?{channel: string, externalUserId: string, messageId: string,
   *     text: string, payload: ?string, location: ?Object, attachment:
   *     ?Object}|Promise<?Object>} The normalized message, or null when the
   *     body is not a user message (for example a delivery receipt). May be a
   *     promise, so callers must await it.
   * @throws {Error} Always, unless overridden by a subclass.
   */
  normalizeIncoming(rawBody) {
    throw new Error('normalizeIncoming() not implemented');
  }

  /**
   * Delivers one outbound message to a user on this channel.
   * @param {string} externalUserId Channel-specific id of the recipient.
   * @param {{text: string, options: (Array<Object>|undefined), optionsStyle:
   *     (string|undefined), listButton: (string|undefined), media:
   *     (Object|undefined)}} message Message to send: text, optional reply
   *     options, and an optional file whose caption is the text.
   * @return {Promise<void>} Resolves once the message has been handed off.
   * @throws {Error} Always, unless overridden by a subclass.
   */
  async send(externalUserId, message) {
    throw new Error('send() not implemented');
  }
}

module.exports = ChannelAdapter;
