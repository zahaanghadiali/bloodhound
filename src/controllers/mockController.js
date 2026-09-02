const mockAdapter = require('../channels/mockAdapter');
const messageProcessor = require('../services/messageProcessor');

/**
 * POST /api/mock/incoming
 * Body: { externalUserId, text?, payload?, location? }
 * Simulates an inbound chat message without any real WhatsApp/Instagram
 * connection — the primary way to exercise every flow step today.
 */
async function incoming(req, res) {
  const normalized = mockAdapter.normalizeIncoming(req.body);
  if (!normalized) {
    return res.status(400).json({ error: 'externalUserId is required' });
  }
  const replies = await messageProcessor.handle(normalized);
  return res.json({ replies });
}

module.exports = { incoming };
