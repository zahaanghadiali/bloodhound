const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const Conversation = require('../models/Conversation');
const accountService = require('../services/accountService');

async function withConversation(id, run) {
  const conversation = await Conversation.findById(id);
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  const result = await run(conversation);
  return NextResponse.json(result);
}

const get = apiHandler(async (req, { params }) => {
  const conversation = await Conversation.findById(params.id);
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  return NextResponse.json({ conversation });
});

const pause = apiHandler(async (req, { params }) =>
  withConversation(params.id, (c) => accountService.pauseAccount(c.channel, c.externalUserId))
);

const resume = apiHandler(async (req, { params }) =>
  withConversation(params.id, (c) => accountService.resumeAccount(c.channel, c.externalUserId))
);

const remove = apiHandler(async (req, { params }) =>
  withConversation(params.id, (c) => accountService.deleteAccount(c.channel, c.externalUserId))
);

module.exports = { get, pause, resume, remove };
