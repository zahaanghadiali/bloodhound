const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const Conversation = require('../models/Conversation');
const accountService = require('../services/accountService');

/**
 * Loads a conversation and checks it belongs to the signed-in pet parent.
 * @param {string} id Conversation id.
 * @param {string} userId Id of the signed-in pet parent.
 * @return {Promise<{conversation: (Object|undefined), error:
 *     (Response|undefined)}>} The conversation, or a 404/403 error response to
 *     return to the client.
 */
async function findOwnConversation(id, userId) {
  const conversation = await Conversation.findById(id);
  if (!conversation) return { error: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }) };
  if (String(conversation.petParent) !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { conversation };
}

/**
 * Runs an action on the caller's own conversation and returns its result as
 * JSON.
 * @param {string} id Conversation id.
 * @param {string} userId Id of the signed-in pet parent.
 * @param {function(Object): Promise<Object>} run Action to run on the
 *     conversation.
 * @return {Promise<Response>} JSON of the action's result, or a 404/403 error
 *     response.
 */
async function withConversation(id, userId, run) {
  const { conversation, error } = await findOwnConversation(id, userId);
  if (error) return error;
  const result = await run(conversation);
  return NextResponse.json(result);
}

/**
 * Handles GET /api/conversations/:id.
 * @param {Request} req Request carrying the x-user-id header.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON with the conversation, or a 404/403 error.
 */
const get = apiHandler(async (req, { params }) => {
  const { conversation, error } = await findOwnConversation(params.id, req.headers.get('x-user-id'));
  if (error) return error;
  return NextResponse.json({ conversation });
});

/**
 * Handles POST /api/conversations/:id/pause: pauses the owning account.
 * @param {Request} req Request carrying the x-user-id header.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON result of the pause, or a 404/403 error.
 */
const pause = apiHandler(async (req, { params }) =>
  withConversation(params.id, req.headers.get('x-user-id'), (c) => accountService.pauseAccount(c.channel, c.externalUserId))
);

/**
 * Handles POST /api/conversations/:id/resume: resumes the owning account.
 * @param {Request} req Request carrying the x-user-id header.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON result of the resume, or a 404/403 error.
 */
const resume = apiHandler(async (req, { params }) =>
  withConversation(params.id, req.headers.get('x-user-id'), (c) => accountService.resumeAccount(c.channel, c.externalUserId))
);

/**
 * Handles POST /api/conversations/:id/delete: deletes the owning account.
 * @param {Request} req Request carrying the x-user-id header.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON result of the deletion, or a 404/403 error.
 */
const remove = apiHandler(async (req, { params }) =>
  withConversation(params.id, req.headers.get('x-user-id'), (c) => accountService.deleteAccount(c.channel, c.externalUserId))
);

module.exports = { get, pause, resume, remove };
