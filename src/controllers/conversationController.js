const Conversation = require('../models/Conversation');
const accountService = require('../services/accountService');

async function getConversation(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  return res.json({ conversation });
}

async function pause(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  const result = await accountService.pauseAccount(conversation.channel, conversation.externalUserId);
  res.json(result);
}

async function resume(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  const result = await accountService.resumeAccount(conversation.channel, conversation.externalUserId);
  res.json(result);
}

async function remove(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  const result = await accountService.deleteAccount(conversation.channel, conversation.externalUserId);
  res.json(result);
}

module.exports = { getConversation, pause, resume, remove };
