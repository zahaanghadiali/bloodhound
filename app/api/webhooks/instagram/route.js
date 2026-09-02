const { verifyWebhook, receiveWebhook } = require('../../../../lib/webhooks/handleWebhook');

const GET = verifyWebhook('instagram');
const POST = receiveWebhook('instagram');

module.exports = { GET, POST };
