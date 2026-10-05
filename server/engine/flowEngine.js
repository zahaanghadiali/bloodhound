const { getFlow, getStep } = require('../flows');
const { validators, getOptions } = require('./stepTypes');

/**
 * Converts a conversation's answers map into a plain object keyed by step id.
 * @param {Object} conversation Conversation document.
 * @return {Object<string, *>} The answers collected so far.
 */
function answersToObject(conversation) {
  return Object.fromEntries(conversation.answers || new Map());
}

/**
 * Runs a step's optional onEnter hook, which performs a side effect (such as
 * sending an OTP code) the moment the step becomes current.
 * @param {Object} step Step definition.
 * @param {Object} conversation Conversation document.
 * @return {Promise<?string>} Extra text to prepend to the step's prompt, or
 *     null if the step has no hook.
 * @throws {Error} If the step's onEnter hook fails.
 */
async function runOnEnter(step, conversation) {
  if (!step.onEnter) return null;
  return step.onEnter(answersToObject(conversation), conversation);
}

/**
 * Resolves a step whose options are a function of the answers so far into a
 * step with a plain options array.
 * @param {Object} step Step definition.
 * @param {Object<string, *>} answersObj Answers collected so far.
 * @return {Object} The step itself, or a copy with its options resolved.
 */
function materialize(step, answersObj) {
  return typeof step.options === 'function' ? { ...step, options: step.options(answersObj) } : step;
}

/**
 * Builds the text shown for a step.
 * @param {Object} step Step definition.
 * @param {Object<string, *>} answersObj Answers collected so far.
 * @param {?string} extra Text to show above the step's own prompt.
 * @return {string} The prompt, with the extra text above it when present.
 */
function buildPrompt(step, answersObj, extra) {
  return [extra, step.prompt(answersObj)].filter(Boolean).join('\n\n');
}

/**
 * Starts a fresh flow on a conversation, mutating it in place.
 * @param {Object} conversation Conversation document.
 * @param {string} flowId Id of the flow to start.
 * @param {{seed: (Object|undefined), firstStepId: (string|undefined)}=} options
 *     seed pre-fills answers the caller already knows; firstStepId overrides
 *     where the flow begins.
 * @return {Promise<{prompt: string, options: ?Array<Object>, listButton:
 *     (string|undefined)}>} The flow's opening message and first prompt, with
 *     its reply options.
 * @throws {Error} If the flow or step id is unknown, or the first step's
 *     onEnter hook fails.
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
 * Feeds one user input into the current step of the conversation's active flow,
 * mutating the conversation in place.
 * @param {Object} conversation Conversation document.
 * @param {{text: (string|undefined), payload: *, location: ?Object, attachment:
 *     ?Object}} input Normalized incoming message.
 * @return {Promise<Object>} One of: {done: false, prompt, options, listButton}
 *     for the next step; the same with an error when validation failed and the
 *     step is shown again; or {done: true, flow, answers} when the flow
 *     finished.
 * @throws {Error} If the flow or step id is unknown, or a validator or onEnter
 *     hook fails.
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

/**
 * Moves back to the previous step, discarding that step's stored answer.
 * @param {Object} conversation Conversation document.
 * @return {Promise<Object>} {ok: true, prompt, options, listButton} for the
 *     previous step, or {ok: false, message} when there is nothing to go back
 *     to.
 * @throws {Error} If the step id is unknown or its onEnter hook fails.
 */
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

/**
 * Abandons the conversation's current flow entirely; used by cancel and
 * restart.
 * @param {Object} conversation Conversation document, mutated in place.
 */
function reset(conversation) {
  conversation.flow = null;
  conversation.currentStepId = null;
  conversation.answers = new Map();
  conversation.history = [];
  conversation.status = 'active';
}

module.exports = { start, advance, back, reset, answersToObject };
