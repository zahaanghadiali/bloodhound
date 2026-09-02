const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const mockAdapter = require('../channels/mockAdapter');
const messageProcessor = require('../services/messageProcessor');

/**
 * POST /api/mock/incoming
 * Body: { externalUserId, text?, payload?, location? }
 * Simulates an inbound chat message without any real WhatsApp/Instagram
 * connection — the primary way to exercise every flow step today.
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
