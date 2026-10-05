const { getAdapter } = require('../channels/adapterFactory');

/**
 * Sends a message outside the normal inbound-webhook reply cycle, for example
 * asking a donor to help or telling a searcher that a donor accepted.
 * @param {string} channel Channel name.
 * @param {string} externalUserId Channel-specific id of the recipient.
 * @param {Object} message Outbound message.
 * @return {Promise<void>} Resolves once the adapter has sent the message.
 * @throws {Error} If the channel is unknown or the adapter fails to send.
 */
async function notify(channel, externalUserId, message) {
  const adapter = getAdapter(channel);
  await adapter.send(externalUserId, message);
}

module.exports = { notify };
