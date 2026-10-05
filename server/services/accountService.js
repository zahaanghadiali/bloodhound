const PetParent = require('../models/PetParent');
const Pet = require('../models/Pet');

/**
 * Finds the active pet parent bound to a channel identity.
 * @param {string} channel Channel name.
 * @param {string} externalUserId Channel-specific user id.
 * @return {Promise<?Object>} The pet parent, or null if none exists or it was
 *     deleted.
 */
async function findParent(channel, externalUserId) {
  return PetParent.findOne({ channel, externalUserId, deletedAt: null });
}

/**
 * Sets the donor status of all of a pet parent's non-deleted pets.
 * @param {string} channel Channel name.
 * @param {string} externalUserId Channel-specific user id.
 * @param {string} donorStatus New status: 'active' or 'paused'.
 * @return {Promise<{ok: boolean, reason: (string|undefined)}>} ok, or the
 *     reason 'no_profile' when the user has no profile.
 */
async function setDonorStatus(channel, externalUserId, donorStatus) {
  const parent = await findParent(channel, externalUserId);
  if (!parent) return { ok: false, reason: 'no_profile' };
  await Pet.updateMany({ owner: parent._id, donorStatus: { $ne: 'deleted' } }, { donorStatus });
  return { ok: true };
}

/**
 * Pauses all of a pet parent's pets as donors.
 * @param {string} channel Channel name.
 * @param {string} externalUserId Channel-specific user id.
 * @return {Promise<{ok: boolean, reason: (string|undefined)}>} ok, or the
 *     reason 'no_profile' when the user has no profile.
 */
async function pauseAccount(channel, externalUserId) {
  return setDonorStatus(channel, externalUserId, 'paused');
}

/**
 * Makes all of a pet parent's paused pets active donors again.
 * @param {string} channel Channel name.
 * @param {string} externalUserId Channel-specific user id.
 * @return {Promise<{ok: boolean, reason: (string|undefined)}>} ok, or the
 *     reason 'no_profile' when the user has no profile.
 */
async function resumeAccount(channel, externalUserId) {
  return setDonorStatus(channel, externalUserId, 'active');
}

/**
 * Soft-deletes a pet parent and marks all of their pets as deleted.
 * @param {string} channel Channel name.
 * @param {string} externalUserId Channel-specific user id.
 * @return {Promise<{ok: boolean, reason: (string|undefined)}>} ok, or the
 *     reason 'no_profile' when the user has no profile.
 */
async function deleteAccount(channel, externalUserId) {
  const parent = await findParent(channel, externalUserId);
  if (!parent) return { ok: false, reason: 'no_profile' };
  await Pet.updateMany({ owner: parent._id }, { donorStatus: 'deleted' });
  parent.deletedAt = new Date();
  await parent.save();
  return { ok: true };
}

module.exports = { findParent, pauseAccount, resumeAccount, deleteAccount };
