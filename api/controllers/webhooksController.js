const { verifyWebhook, receiveWebhook } = require('../webhooks/handleWebhook');

module.exports = {
  verifyWhatsapp: verifyWebhook('whatsapp'),
  receiveWhatsapp: receiveWebhook('whatsapp'),
  verifyInstagram: verifyWebhook('instagram'),
  receiveInstagram: receiveWebhook('instagram'),
};
