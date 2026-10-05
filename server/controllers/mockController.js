const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const mockAdapter = require('../channels/mockAdapter');
const messageProcessor = require('../services/messageProcessor');

/**
 * Handles POST /api/mock/incoming: simulates an inbound chat message without a
 * real WhatsApp or Instagram connection.
 * @param {Request} req Request whose JSON body has externalUserId and optional
 *     text, payload, location and attachment.
 * @return {Promise<Response>} JSON with the bot's replies; 400 if
 *     externalUserId is missing.
 */
const incoming = apiHandler(async (req) => {
  const body = await req.json();
  const normalized = mockAdapter.normalizeIncoming(body);
  if (!normalized) {
    return NextResponse.json({ error: 'externalUserId is required' }, { status: 400 });
  }
  const replies = await messageProcessor.handle(normalized);
  return NextResponse.json({ replies });
});

module.exports = { incoming };
