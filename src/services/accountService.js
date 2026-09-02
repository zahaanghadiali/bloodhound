const PetParent = require('../models/PetParent');
const Pet = require('../models/Pet');

async function findParent(channel, externalUserId) {
  return PetParent.findOne({ channel, externalUserId, deletedAt: null });
}

async function setDonorStatus(channel, externalUserId, donorStatus) {
  const parent = await findParent(channel, externalUserId);
  if (!parent) return { ok: false, reason: 'no_profile' };
  await Pet.updateMany({ owner: parent._id, donorStatus: { $ne: 'deleted' } }, { donorStatus });
  return { ok: true };
}

async function pauseAccount(channel, externalUserId) {
  return setDonorStatus(channel, externalUserId, 'paused');
}

async function resumeAccount(channel, externalUserId) {
  return setDonorStatus(channel, externalUserId, 'active');
}

async function deleteAccount(channel, externalUserId) {
  const parent = await findParent(channel, externalUserId);
  if (!parent) return { ok: false, reason: 'no_profile' };
  await Pet.updateMany({ owner: parent._id }, { donorStatus: 'deleted' });
  parent.deletedAt = new Date();
  await parent.save();
  return { ok: true };
}

module.exports = { findParent, pauseAccount, resumeAccount, deleteAccount };
