const findDonor = require('./findDonorFlow');
const registerDonor = require('./registerDonorFlow');

const flows = {
  [findDonor.id]: findDonor,
  [registerDonor.id]: registerDonor,
};

/**
 * Looks up a flow definition.
 * @param {string} flowId Flow id, such as 'findDonor'.
 * @return {Object} The flow definition.
 * @throws {Error} If no flow has that id.
 */
function getFlow(flowId) {
  const flow = flows[flowId];
  if (!flow) throw new Error(`Unknown flow: ${flowId}`);
  return flow;
}

/**
 * Looks up a step within a flow.
 * @param {string} flowId Flow id.
 * @param {string} stepId Step id.
 * @return {Object} The step definition.
 * @throws {Error} If the flow or the step does not exist.
 */
function getStep(flowId, stepId) {
  const flow = getFlow(flowId);
  const step = flow.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`Unknown step "${stepId}" in flow "${flowId}"`);
  return step;
}

module.exports = { flows, getFlow, getStep };
