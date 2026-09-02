const { NextResponse } = require('next/server');
const { apiHandler } = require('../../../../lib/utils/apiHandler');
const Conversation = require('../../../../lib/models/Conversation');

const GET = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const conversation = await Conversation.findById(id);
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  return NextResponse.json({ conversation });
});

module.exports = { GET };
