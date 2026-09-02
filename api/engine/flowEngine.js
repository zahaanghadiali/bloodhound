const { getFlow, getStep } = require('../flows');
const { validators, getOptions } = require('./stepTypes');

function answersToObject(conversation) {
  return Object.fromEntries(conversation.answers || new Map());
}

/**
 * Steps may define an async `onEnter(answers, conversation)` hook that runs
 * a side effect (e.g. sending an OTP code) the moment the step becomes
 * current, and can return extra text to prepend to its prompt.
 */
async function runOnEnter(step, conversation) {
  if (!step.onEnter) return null;
  return step.onEnter(answersToObject(conversation), conversation);
}

function buildPrompt(step, answersObj, extra) {
  return [extra, step.prompt(answersObj)].filter(Boolean).join('\n\n');
}

/** Start a fresh flow on a conversation. Returns the first step's prompt (+ quick-reply options, if any). */
async function start(conversation, flowId) {
  const flow = getFlow(flowId);
  conversation.flow = flowId;
  conversation.currentStepId = flow.firstStepId;
  conversation.answers = new Map();
  conversation.history = [];
  conversation.status = 'active';
  const firstStep = getStep(flowId, flow.firstStepId);
  const extra = await runOnEnter(firstStep, conversation);
  const stepPrompt = buildPrompt(firstStep, answersToObject(conversation), extra);
  return { prompt: [flow.openingMessage, stepPrompt].join('\n\n'), options: getOptions(firstStep) };
}

/**
 * Feed one user input into the current step of the conversation's active flow.
 * Returns one of:
 *   { done: false, prompt, options }               - re-prompt / move to next step
 *   { done: false, error, prompt, options }        - validation failed, same step re-shown
 *   { done: true, flow, answers }                  - flow finished, caller should run completion logic
 */
async function advance(conversation, input) {
  const flow = getFlow(conversation.flow);
  const step = getStep(flow.id, conversation.currentStepId);
  const validator = validators[step.type];
  const result = await validator(input, step, conversation);

  if (!result.valid) {
    return {
      done: false,
      error: result.error,
      prompt: step.prompt(answersToObject(conversation)),
      options: getOptions(step),
    };
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
  const extra = await runOnEnter(nextStep, conversation);
  return { done: false, prompt: buildPrompt(nextStep, answersObj, extra), options: getOptions(nextStep) };
}

/** Move back to the previous step, discarding the current step's stored answer. */
async function back(conversation) {
  if (!conversation.flow || conversation.history.length === 0) {
    return { ok: false, message: "You're already at the start of this section." };
  }
  const previousStepId = conversation.history.pop();
  conversation.answers.delete(previousStepId);
  conversation.currentStepId = previousStepId;
  const step = getStep(conversation.flow, previousStepId);
  const extra = await runOnEnter(step, conversation);
  return { ok: true, prompt: buildPrompt(step, answersToObject(conversation), extra), options: getOptions(step) };
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
