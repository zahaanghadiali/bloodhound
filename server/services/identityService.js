const PetParent = require('../models/PetParent');

/**
 * Frees up {channel, externalUserId} by relocating whatever's currently
 * there (if anything, and if it isn't the account we're about to bind, and
 * if it isn't already the same phone number — see resolveParentByPhone's
 * concurrent-signup note) to a throwaway id. Never deletes it — it may
 * still own real data (pets, requests) under its own identity, just not
 * this device anymore.
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
 * Resolves the PetParent for a verified {channel, phone}, rebasing its
 * externalUserId onto the current device/session if it was last seen from a
 * different one. externalUserId is not a durable identity on its own (the
 * web demo's anonymous chat id is fresh every page load — see
 * components/chat/lib/session.js), so trusting it alone to key an account
 * lookup silently forks a phone number into duplicate accounts every time
 * sign-in happens from a "new" id. Phone number is the real identity;
 * externalUserId is just "which device is this device right now."
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

  // No account for this phone yet — before creating one, make sure nothing
  // else (e.g. a different phone number used anonymously on this device
  // earlier) is already sitting at this externalUserId, or it'd get
  // silently reused/overwritten instead of a fresh account being created.
  // Passing `phone` here means a concurrent sibling call that already won
  // this exact race and inserted the very doc we're about to fetch below
  // won't get mistaken for an unrelated squatter and evicted out from
  // under itself, which would otherwise fork one signup into two accounts.
  await evictSquatter(channel, externalUserId, null, phone);
  // findOneAndUpdate's upsert (not a separate find+create) so two
  // near-simultaneous sign-ins for the same brand-new phone/device can't
  // both pass the check above and then race to insert, tripping the
  // unique {channel, externalUserId} index.
  const created = await PetParent.findOneAndUpdate(
    { channel, externalUserId },
    { $setOnInsert: { channel, externalUserId, phone } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { parent: created, isNew: true };
}

module.exports = { resolveParentByPhone };
