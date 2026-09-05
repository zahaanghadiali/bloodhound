const { getAdapter } = require('../channels/adapterFactory');

/**
 * Sends a message outside of the normal inbound-webhook reply cycle — e.g.
 * asking a donor to help, or telling a searcher a donor accepted. Channel
 * adapters' send() only needs a channel + externalUserId, so this works the
 * same whether or not the recipient is mid-conversation right now.
 */
async function notify(channel, externalUserId, message) {
  const adapter = getAdapter(channel);
  await adapter.send(externalUserId, message);
}

module.exports = { notify };
