const { getFlow, getStep } = require('../flows');
const validators = require('./stepTypes');

function answersToObject(conversation) {
  return Object.fromEntries(conversation.answers || new Map());
}

/** Start a fresh flow on a conversation. Returns the first step's prompt. */
function start(conversation, flowId) {
  const flow = getFlow(flowId);
  conversation.flow = flowId;
  conversation.currentStepId = flow.firstStepId;
  conversation.answers = new Map();
  conversation.history = [];
  conversation.status = 'active';
  const firstStep = getStep(flowId, flow.firstStepId);
  return { prompt: [flow.openingMessage, firstStep.prompt(answersToObject(conversation))].join('\n\n') };
}

/**
 * Feed one user input into the current step of the conversation's active flow.
 * Returns one of:
 *   { done: false, prompt }               - re-prompt / move to next step
 *   { done: false, error, prompt }        - validation failed, same step re-shown
 *   { done: true, flow, answers }         - flow finished, caller should run completion logic
 */
function advance(conversation, input) {
  const flow = getFlow(conversation.flow);
  const step = getStep(flow.id, conversation.currentStepId);
  const validator = validators[step.type];
  const result = validator(input, step);

  if (!result.valid) {
    return { done: false, error: result.error, prompt: step.prompt(answersToObject(conversation)) };
  }

  conversation.answers.set(step.id, result.value);
  conversation.history.push(step.id);

  const answersObj = answersToObject(conversation);
  const nextStepId = step.next(answersObj);

  if (!nextStepId) {
    conversation.status = 'completed';
    return { done: true, flow: flow.id, answers: answersObj };
  }

  conversation.currentStepId = nextStepId;
  const nextStep = getStep(flow.id, nextStepId);
  return { done: false, prompt: nextStep.prompt(answersObj) };
}

/** Move back to the previous step, discarding the current step's stored answer. */
function back(conversation) {
  if (!conversation.flow || conversation.history.length === 0) {
    return { ok: false, message: "You're already at the start of this section." };
  }
  const previousStepId = conversation.history.pop();
  conversation.answers.delete(previousStepId);
  conversation.currentStepId = previousStepId;
  const step = getStep(conversation.flow, previousStepId);
  return { ok: true, prompt: step.prompt(answersToObject(conversation)) };
}

/** Abandon the current flow entirely (used by cancel/restart). */
function reset(conversation) {
  conversation.flow = null;
  conversation.currentStepId = null;
  conversation.answers = new Map();
  conversation.history = [];
  conversation.status = 'active';
}

module.exports = { start, advance, back, reset, answersToObject };
