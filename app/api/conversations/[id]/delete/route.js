const { NextResponse } = require('next/server');
const { apiHandler } = require('../../../../../lib/utils/apiHandler');
const Conversation = require('../../../../../lib/models/Conversation');
const accountService = require('../../../../../lib/services/accountService');

const POST = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const conversation = await Conversation.findById(id);
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  const result = await accountService.deleteAccount(conversation.channel, conversation.externalUserId);
  return NextResponse.json(result);
});

module.exports = { POST };
