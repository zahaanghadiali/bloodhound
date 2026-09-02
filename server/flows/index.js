const findDonor = require('./findDonorFlow');
const registerDonor = require('./registerDonorFlow');

const flows = {
  [findDonor.id]: findDonor,
  [registerDonor.id]: registerDonor,
};

function getFlow(flowId) {
  const flow = flows[flowId];
  if (!flow) throw new Error(`Unknown flow: ${flowId}`);
  return flow;
}

function getStep(flowId, stepId) {
  const flow = getFlow(flowId);
  const step = flow.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`Unknown step "${stepId}" in flow "${flowId}"`);
  return step;
}

module.exports = { flows, getFlow, getStep };
