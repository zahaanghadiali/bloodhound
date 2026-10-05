const mockAdapter = require('./mockAdapter');
const whatsappAdapter = require('./whatsappAdapter');
const instagramAdapter = require('./instagramAdapter');

const adapters = {
  mock: mockAdapter,
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
};

/**
 * Looks up the channel adapter for a messaging channel.
 * @param {string} channel Channel name: 'mock', 'whatsapp' or 'instagram'.
 * @return {Object} The adapter instance for that channel.
 * @throws {Error} If no adapter exists for the channel.
 */
function getAdapter(channel) {
  const adapter = adapters[channel];
  if (!adapter) throw new Error(`Unknown channel: ${channel}`);
  return adapter;
}

module.exports = { getAdapter };
