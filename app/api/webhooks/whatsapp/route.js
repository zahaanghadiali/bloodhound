const { verifyWebhook, receiveWebhook } = require('../../../../lib/webhooks/handleWebhook');

const GET = verifyWebhook('whatsapp');
const POST = receiveWebhook('whatsapp');

module.exports = { GET, POST };
