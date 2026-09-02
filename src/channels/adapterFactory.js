const mockAdapter = require('./mockAdapter');
const whatsappAdapter = require('./whatsappAdapter');
const instagramAdapter = require('./instagramAdapter');

const adapters = {
  mock: mockAdapter,
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
};

function getAdapter(channel) {
  const adapter = adapters[channel];
  if (!adapter) throw new Error(`Unknown channel: ${channel}`);
  return adapter;
}

module.exports = { getAdapter };
