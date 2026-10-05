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

/**
 * A choice step's `options` may be a function of the answers so far (e.g.
 * "which of your pets?") — this pins them down to a plain array, which is
 * what the validators and getOptions expect.
 */
function materialize(step, answersObj) {
  return typeof step.options === 'function' ? { ...step, options: step.options(answersObj) } : step;
}

function buildPrompt(step, answersObj, extra) {
  return [extra, step.prompt(answersObj)].filter(Boolean).join('\n\n');
}

/**
 * Start a fresh flow on a conversation. Returns the first step's prompt (+ quick-reply options, if any).
 * `seed` pre-fills answers the caller already knows (so steps can read or
 * skip them), and `firstStepId` overrides where the flow begins.
 */
async function start(conversation, flowId, { seed = {}, firstStepId } = {}) {
  const flow = getFlow(flowId);
  conversation.flow = flowId;
  conversation.currentStepId = firstStepId || flow.firstStepId;
  conversation.answers = new Map(Object.entries(seed));
  conversation.history = [];
  conversation.status = 'active';
  const answersObj = answersToObject(conversation);
  const firstStep = materialize(getStep(flowId, conversation.currentStepId), answersObj);
  const extra = await runOnEnter(firstStep, conversation);
  const stepPrompt = buildPrompt(firstStep, answersObj, extra);
  return {
    prompt: [flow.openingMessage, stepPrompt].join('\n\n'),
    options: getOptions(firstStep),
    listButton: firstStep.listButton,
  };
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
  const step = materialize(getStep(flow.id, conversation.currentStepId), answersToObject(conversation));
  const validator = validators[step.type];
  const result = await validator(input, step, conversation);

  if (!result.valid) {
    return {
      done: false,
      error: result.error,
      prompt: step.prompt(answersToObject(conversation)),
      options: getOptions(step),
      listButton: step.listButton,
    };
  }

  conversation.answers.set(step.id, result.value);
  conversation.history.push(step.id);

  const answersObj = answersToObject(conversation);
  const nextStepId = step.next(answersObj, conversation);

  if (!nextStepId) {
    conversation.status = 'completed';
    return { done: true, flow: flow.id, answers: answersObj };
  }

  conversation.currentStepId = nextStepId;
  const nextStep = materialize(getStep(flow.id, nextStepId), answersObj);
  const extra = await runOnEnter(nextStep, conversation);
  return {
    done: false,
    prompt: buildPrompt(nextStep, answersObj, extra),
    options: getOptions(nextStep),
    listButton: nextStep.listButton,
  };
}

/** Move back to the previous step, discarding the current step's stored answer. */
async function back(conversation) {
  if (!conversation.flow || conversation.history.length === 0) {
    return { ok: false, message: "You're already at the start of this section." };
  }
  const previousStepId = conversation.history.pop();
  conversation.answers.delete(previousStepId);
  conversation.currentStepId = previousStepId;
  const answersObj = answersToObject(conversation);
  const step = materialize(getStep(conversation.flow, previousStepId), answersObj);
  const extra = await runOnEnter(step, conversation);
  return { ok: true, prompt: buildPrompt(step, answersObj, extra), options: getOptions(step), listButton: step.listButton };
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
