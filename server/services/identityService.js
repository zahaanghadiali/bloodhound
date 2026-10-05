const PetParent = require('../models/PetParent');

/**
 * Frees up a channel identity by moving whatever account currently holds it to
 * a throwaway id. The account is never deleted, since it may still own pets or
 * requests.
 * @param {string} channel Channel name.
 * @param {string} externalUserId Channel-specific user id to free up.
 * @param {?Object} exceptId Id of the account about to be bound, which is left
 *     alone.
 * @param {string} exceptPhone Phone number being signed in; an account already
 *     holding it is left alone.
 * @return {Promise<void>} Resolves once any squatter has been moved.
 */
async function evictSquatter(channel, externalUserId, exceptId, exceptPhone) {
  const filter = { channel, externalUserId };
  if (exceptId) filter._id = { $ne: exceptId };
  const squatter = await PetParent.findOne(filter);
  if (squatter && squatter.phone !== exceptPhone) {
    squatter.externalUserId = `vacated-${squatter._id}`;
    await squatter.save();
  }
}

/**
 * Resolves the pet parent for a verified phone number, creating one if needed
 * and rebinding it to the current device or session. The phone number is the
 * real identity; externalUserId only says which device is in use right now.
 * @param {{channel: string, externalUserId: string, phone: string}} identity
 *     Channel, current device id and verified phone number.
 * @return {Promise<{parent: Object, isNew: boolean}>} The pet parent and
 *     whether it was just created.
 */
async function resolveParentByPhone({ channel, externalUserId, phone }) {
  const existing = await PetParent.findOne({ channel, phone, deletedAt: null });

  if (existing) {
    if (existing.externalUserId !== externalUserId) {
      await evictSquatter(channel, externalUserId, existing._id, phone);
      existing.externalUserId = externalUserId;
      await existing.save();
    }
    return { parent: existing, isNew: false };
  }

  await evictSquatter(channel, externalUserId, null, phone);
  const created = await PetParent.findOneAndUpdate(
    { channel, externalUserId },
    { $setOnInsert: { channel, externalUserId, phone } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { parent: created, isNew: true };
}

module.exports = { resolveParentByPhone };
