const DonorRequest = require('../models/DonorRequest');
const Conversation = require('../models/Conversation');
const PetParent = require('../models/PetParent');
const Pet = require('../models/Pet');
const notificationService = require('./notificationService');
const { donorRequest: config } = require('../config/env');

const DONOR_RESPONSE_OPTIONS = [
  { value: true, label: '✅ I can help', keywords: ['yes', 'y', 'accept', 'i can help', 'help'] },
  { value: false, label: '🙅 Not this time', keywords: ['no', 'n', 'decline', 'not now', 'pass'] },
];

const UNLIMITED_CONFIRM_OPTIONS = [
  { value: true, label: '✅ Yes, keep looking', keywords: ['yes', 'y', 'unlimited', 'keep looking'] },
  { value: false, label: '❌ No, stop searching', keywords: ['no', 'n', 'stop'] },
];

/**
 * Picks the emoji shown next to a pet of a given species.
 * @param {string} species 'dog' or 'cat'.
 * @return {string} A dog emoji for dogs, a cat emoji otherwise.
 */
function speciesEmoji(species) {
  return species === 'dog' ? '🐶' : '🐱';
}

/**
 * Computes a point in time a number of minutes ahead of now.
 * @param {number} minutes Minutes to add to the current time.
 * @return {Date} The resulting date.
 */
function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Escapes regular-expression metacharacters so text matches literally.
 * @param {string} text Text to escape.
 * @return {string} The escaped text.
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds a searcher's live donor search. There is at most one per searcher, so a
 * reply is never ambiguous about which request it concerns.
 * @param {string|Object} searcherParentId Id of the searching pet parent.
 * @return {Promise<?Object>} The active, awaiting-confirmation or unlimited
 *     request, or null.
 */
async function findActiveForSearcher(searcherParentId) {
  return DonorRequest.findOne({
    searcher: searcherParentId,
    phase: { $in: ['active', 'awaiting_unlimited_confirmation', 'unlimited'] },
  });
}

/**
 * Lists a donor's pets that can answer a request for a species right now.
 * @param {string|Object} ownerId Id of the donor's pet parent.
 * @param {string} species 'dog' or 'cat'.
 * @return {Promise<Array<Object>>} The owner's active donor pets of that
 *     species, oldest first.
 */
async function getEligiblePets(ownerId, species) {
  return Pet.find({ owner: ownerId, species, donorStatus: 'active' }).sort({ createdAt: 1 });
}

/**
 * Finds donor accounts to ask in one pass: verified owners with a matching
 * active pet who have not been asked yet and are not the searcher. A 'radius'
 * request matches by distance from the searcher's point (uncapped once
 * unlimited); a 'text' request matches the typed area against donors'
 * locationText.
 * @param {Object} request DonorRequest document.
 * @return {Promise<Array<Object>>} Unique PetParent documents, each owner once
 *     even when several of their pets match.
 */
async function findCandidateOwners(request) {
  const alreadyNotified = new Set(request.notifiedOwners.map((n) => String(n.owner)));

  const query = {
    species: request.species,
    donorStatus: 'active',
    owner: { $ne: request.searcher },
  };

  if (request.searchMode === 'text') {
    query.locationText = { $regex: escapeRegex(request.locationText || ''), $options: 'i' };
  } else {
    query.location = request.phase === 'unlimited'
      ? { $near: { $geometry: request.location } }
      : { $near: { $geometry: request.location, $maxDistance: request.currentRadiusKm * 1000 } };
  }

  const pets = await Pet.find(query).populate('owner').limit(500);

  const owners = new Map();
  for (const pet of pets) {
    const owner = pet.owner;
    if (!owner || owner.deletedAt || !owner.phoneVerifiedAt) continue;
    const ownerId = String(owner._id);
    if (alreadyNotified.has(ownerId) || owners.has(ownerId)) continue;
    owners.set(ownerId, owner);
  }
  return [...owners.values()];
}

/**
 * Asks every newly in-range donor account that has not been asked yet to help,
 * and records them on the request. This is the only place a searcher's contact
 * details are disclosed.
 * @param {Object} request DonorRequest document.
 * @return {Promise<number>} Number of donor accounts found in this pass.
 * @throws {Error} If a notification cannot be sent.
 */
async function notifyNewDonorsInRadius(request) {
  const searcher = await PetParent.findById(request.searcher);
  if (!searcher) return 0;

  const owners = await findCandidateOwners(request);
  if (owners.length === 0) return 0;

  const askText =
    `🚨 ${searcher.name || 'A Bloodhound user'} nearby needs a ${request.species} blood donor` +
    `${request.locationText ? ` (near ${request.locationText})` : ''}.\n` +
    `👤 ${searcher.name || 'Unknown'}  📞 ${searcher.phone || 'N/A'}\n\n` +
    `Can one of your pets help?`;

  for (const owner of owners) {
    const conversation = await Conversation.findOne({ channel: owner.channel, externalUserId: owner.externalUserId });
    if (!conversation) continue;

    conversation.pendingDonorRequests.push({ requestId: request._id });
    await conversation.save();

    await notificationService.notify(owner.channel, owner.externalUserId, {
      text: askText,
      options: DONOR_RESPONSE_OPTIONS,
    });
  }

  request.notifiedOwners.push(...owners.map((owner) => ({ owner: owner._id, status: 'pending' })));
  await request.save();
  return owners.length;
}

/**
 * Creates a radius search and runs the first notification pass at the starting
 * radius.
 * @param {{searcherParentId: (string|Object), species: string, point:
 *     {coordinates: Array<number>}, locationText: (string|undefined),
 *     maxRadiusKm: number}} search Who is searching, for which species, from
 *     where and how far at most.
 * @return {Promise<string>} Status text to show the searcher.
 * @throws {Error} If the request cannot be saved or a notification fails.
 */
async function createRequest({ searcherParentId, species, point, locationText, maxRadiusKm }) {
  const request = await DonorRequest.create({
    searcher: searcherParentId,
    species,
    searchMode: 'radius',
    location: { type: 'Point', coordinates: point.coordinates },
    locationText,
    maxRadiusKm,
    currentRadiusKm: Math.min(config.startRadiusKm, maxRadiusKm),
    phase: 'active',
    nextExpansionAt: minutesFromNow(config.expansionIntervalMinutes),
  });

  const notified = await notifyNewDonorsInRadius(request);
  const area = locationText || 'your area';
  const reachedOut = notified > 0
    ? `We've reached out to ${notified} donor${notified === 1 ? '' : 's'} within ${request.currentRadiusKm}km of ${area}.`
    : `No donors within ${request.currentRadiusKm}km of ${area} yet — we'll widen the search automatically every ${config.expansionIntervalMinutes} minutes.`;
  return `🐾 Search started. ${reachedOut}\nWe'll message you the moment someone says yes. Say "my searches" any time to check status, or "stop searching" to end it.`;
}

/**
 * Creates a city or area text search with no pin and no radius to expand. It
 * matches donors whose locationText mentions the area straight away, and the
 * cron tick keeps re-scanning for newly registered donors.
 * @param {{searcherParentId: (string|Object), species: string, locationText:
 *     string}} search Who is searching, for which species and in which typed
 *     area.
 * @return {Promise<string>} Status text to show the searcher.
 * @throws {Error} If the request cannot be saved or a notification fails.
 */
async function createTextSearchRequest({ searcherParentId, species, locationText }) {
  const request = await DonorRequest.create({
    searcher: searcherParentId,
    species,
    searchMode: 'text',
    locationText,
    phase: 'unlimited',
    nextExpansionAt: minutesFromNow(config.expansionIntervalMinutes),
  });

  const notified = await notifyNewDonorsInRadius(request);
  const reachedOut = notified > 0
    ? `We've reached out to ${notified} donor${notified === 1 ? '' : 's'} in ${locationText}.`
    : `No donors in ${locationText} yet — we'll keep checking as new ones register.`;
  return `🐾 Search started. ${reachedOut}\nWe'll message you the moment someone says yes. Say "my searches" any time to check status, or "stop searching" to end it.`;
}

/**
 * Advances an 'active' request by one cron step: widens the radius and notifies
 * new donors, or, once the maximum radius is reached, asks the searcher whether
 * to continue with no distance limit.
 * @param {Object} request DonorRequest document, mutated and saved.
 * @return {Promise<void>} Resolves once the request has been updated.
 * @throws {Error} If a notification cannot be sent.
 */
async function expandRequest(request) {
  if (request.currentRadiusKm >= request.maxRadiusKm) {
    request.phase = 'awaiting_unlimited_confirmation';
    request.nextExpansionAt = null;
    await request.save();

    const searcher = await PetParent.findById(request.searcher);
    if (searcher) {
      const conversation = await Conversation.findOne({ channel: searcher.channel, externalUserId: searcher.externalUserId });
      if (conversation) {
        conversation.pendingUnlimitedConfirmRequestId = request._id;
        await conversation.save();
      }
      await notificationService.notify(searcher.channel, searcher.externalUserId, {
        text:
          `We haven't found a donor within ${request.maxRadiusKm}km yet. ` +
          `Want us to keep looking with no distance limit?`,
        options: UNLIMITED_CONFIRM_OPTIONS,
      });
    }
    return;
  }

  request.currentRadiusKm = Math.min(request.currentRadiusKm + config.expansionStepKm, request.maxRadiusKm);
  request.nextExpansionAt = minutesFromNow(config.expansionIntervalMinutes);
  await request.save();
  await notifyNewDonorsInRadius(request);
}

/**
 * Advances an 'unlimited' request by one cron step, catching donors who
 * registered or came into range since the last pass.
 * @param {Object} request DonorRequest document, mutated and saved.
 * @return {Promise<void>} Resolves once new donors have been notified.
 * @throws {Error} If a notification cannot be sent.
 */
async function reNotifyUnlimited(request) {
  request.nextExpansionAt = minutesFromNow(config.expansionIntervalMinutes);
  await request.save();
  await notifyNewDonorsInRadius(request);
}

/**
 * Ends a donor search at the searcher's request.
 * @param {Object} request DonorRequest document, mutated and saved.
 * @return {Promise<void>} Resolves once the request has been saved.
 */
async function stopRequest(request) {
  request.phase = 'stopped';
  request.nextExpansionAt = null;
  await request.save();
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Closes out anything left unresolved for 30 days: whole searches still open 30
 * days after they started, and individual asks still pending 30 days after that
 * donor was notified.
 * @return {Promise<{expiredRequests: number, expiredAsks: number}>} How many
 *     requests and how many requests' asks were expired.
 */
async function expireStaleRequests() {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const requests = await DonorRequest.updateMany(
    { phase: { $in: ['active', 'awaiting_unlimited_confirmation', 'unlimited'] }, createdAt: { $lte: cutoff } },
    { $set: { phase: 'expired', nextExpansionAt: null } }
  );

  const asks = await DonorRequest.updateMany(
    { notifiedOwners: { $elemMatch: { status: 'pending', notifiedAt: { $lte: cutoff } } } },
    { $set: { 'notifiedOwners.$[elem].status': 'expired' } },
    { arrayFilters: [{ 'elem.status': 'pending', 'elem.notifiedAt': { $lte: cutoff } }] }
  );

  return { expiredRequests: requests.modifiedCount, expiredAsks: asks.modifiedCount };
}

/**
 * Records a donor account's answer to its ask. On accept, the searcher is sent
 * the donor's contact details; this is the only place they are disclosed.
 * @param {Object} request DonorRequest document, mutated and saved.
 * @param {string|Object} ownerId Id of the responding donor's pet parent.
 * @param {{accepted: boolean, petId: ?(string|Object)}} response Whether the
 *     donor accepted and, if so, which pet is donating.
 * @return {Promise<?Object>} The updated notifiedOwners entry, or null if this
 *     owner was never asked about the request.
 * @throws {Error} If the searcher cannot be notified.
 */
async function recordDonorResponse(request, ownerId, { accepted, petId }) {
  const entry = request.notifiedOwners.find((n) => String(n.owner) === String(ownerId));
  if (!entry) return null;

  entry.status = accepted ? 'accepted' : 'declined';
  entry.petId = accepted ? petId : null;
  entry.respondedAt = new Date();
  await request.save();

  if (accepted) {
    const [searcher, pet, owner] = await Promise.all([
      PetParent.findById(request.searcher),
      Pet.findById(petId),
      PetParent.findById(ownerId),
    ]);
    if (searcher) {
      const bloodType = pet?.bloodType?.known ? ` 🩸 ${pet.bloodType.value}` : '';
      await notificationService.notify(searcher.channel, searcher.externalUserId, {
        text:
          `🎉 Good news — a donor said yes!\n` +
          `${pet?.name || 'Their pet'} ${speciesEmoji(pet?.species || request.species)}${bloodType}\n` +
          `👤 ${owner?.name || 'Unknown'}  📞 ${owner?.phone || 'N/A'}\n\n` +
          `We'll keep the search running for backups — say "stop searching" once you're sorted.`,
      });
    }
  }

  return entry;
}

/**
 * Removes a queued ask from an owner's conversation, so the bot does not ask
 * again after they answered through the web UI.
 * @param {string|Object} ownerParentId Id of the donor's pet parent.
 * @param {string|Object} requestId Id of the DonorRequest.
 * @return {Promise<void>} Resolves once the ask has been removed.
 */
async function clearPendingAsk(ownerParentId, requestId) {
  const owner = await PetParent.findById(ownerParentId);
  if (!owner) return;
  await Conversation.updateOne(
    { channel: owner.channel, externalUserId: owner.externalUserId },
    { $pull: { pendingDonorRequests: { requestId } } }
  );
}

/**
 * Lists every search a pet parent has started, newest first, with details of
 * everyone who has accepted so far.
 * @param {string|Object} searcherParentId Id of the searching pet parent.
 * @return {Promise<Array<Object>>} Request summaries, each with an `accepted`
 *     list of owner, pet and response time.
 */
async function listSentForSearcher(searcherParentId) {
  const requests = await DonorRequest.find({ searcher: searcherParentId })
    .sort({ createdAt: -1 })
    .populate('notifiedOwners.owner', 'name phone')
    .populate('notifiedOwners.petId', 'name species bloodType');

  return requests.map((r) => ({
    _id: r._id,
    species: r.species,
    searchMode: r.searchMode,
    locationText: r.locationText,
    phase: r.phase,
    currentRadiusKm: r.currentRadiusKm,
    maxRadiusKm: r.maxRadiusKm,
    createdAt: r.createdAt,
    accepted: r.notifiedOwners
      .filter((n) => n.status === 'accepted')
      .map((n) => ({
        owner: n.owner ? { name: n.owner.name, phone: n.owner.phone } : null,
        pet: n.petId ? { name: n.petId.name, species: n.petId.species, bloodType: n.petId.bloodType } : null,
        respondedAt: n.respondedAt,
      })),
  }));
}

/**
 * Lists every request a pet parent's account has been asked about, newest
 * first, with their own status and, for pending ones, their eligible pets.
 * @param {string|Object} ownerParentId Id of the donor's pet parent.
 * @return {Promise<Array<Object>>} Request summaries from the donor's point of
 *     view.
 */
async function listReceivedForOwner(ownerParentId) {
  const requests = await DonorRequest.find({ 'notifiedOwners.owner': ownerParentId })
    .sort({ createdAt: -1 })
    .populate('searcher', 'name phone')
    .populate('notifiedOwners.petId', 'name species');

  const results = [];
  for (const r of requests) {
    const mine = r.notifiedOwners.find((n) => String(n.owner) === String(ownerParentId));
    if (!mine) continue;
    results.push({
      _id: r._id,
      species: r.species,
      locationText: r.locationText,
      phase: r.phase,
      createdAt: r.createdAt,
      myStatus: mine.status,
      myPet: mine.petId ? { _id: mine.petId._id, name: mine.petId.name, species: mine.petId.species } : null,
      searcher: { name: r.searcher?.name || null, phone: r.searcher?.phone || null },
      eligiblePets:
        mine.status === 'pending'
          ? (await getEligiblePets(ownerParentId, r.species)).map((p) => ({ _id: p._id, name: p.name, species: p.species }))
          : [],
    });
  }
  return results;
}

module.exports = {
  DONOR_RESPONSE_OPTIONS,
  UNLIMITED_CONFIRM_OPTIONS,
  findActiveForSearcher,
  getEligiblePets,
  createRequest,
  createTextSearchRequest,
  notifyNewDonorsInRadius,
  expandRequest,
  reNotifyUnlimited,
  stopRequest,
  expireStaleRequests,
  recordDonorResponse,
  clearPendingAsk,
  listSentForSearcher,
  listReceivedForOwner,
};
