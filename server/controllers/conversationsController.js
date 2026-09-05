const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const Conversation = require('../models/Conversation');
const accountService = require('../services/accountService');

/** Only the conversation's own PetParent (never another signed-in user) may read or act on it. */
async function findOwnConversation(id, userId) {
  const conversation = await Conversation.findById(id);
  if (!conversation) return { error: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }) };
  if (String(conversation.petParent) !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { conversation };
}

async function withConversation(id, userId, run) {
  const { conversation, error } = await findOwnConversation(id, userId);
  if (error) return error;
  const result = await run(conversation);
  return NextResponse.json(result);
}

const get = apiHandler(async (req, { params }) => {
  const { conversation, error } = await findOwnConversation(params.id, req.headers.get('x-user-id'));
  if (error) return error;
  return NextResponse.json({ conversation });
});

const pause = apiHandler(async (req, { params }) =>
  withConversation(params.id, req.headers.get('x-user-id'), (c) => accountService.pauseAccount(c.channel, c.externalUserId))
);

const resume = apiHandler(async (req, { params }) =>
  withConversation(params.id, req.headers.get('x-user-id'), (c) => accountService.resumeAccount(c.channel, c.externalUserId))
);

const remove = apiHandler(async (req, { params }) =>
  withConversation(params.id, req.headers.get('x-user-id'), (c) => accountService.deleteAccount(c.channel, c.externalUserId))
);

module.exports = { get, pause, resume, remove };
