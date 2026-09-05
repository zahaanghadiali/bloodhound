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

function speciesEmoji(species) {
  return species === 'dog' ? '🐶' : '🐱';
}

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** At most one live search per searcher — keeps "which request is this reply about" unambiguous. */
async function findActiveForSearcher(searcherParentId) {
  return DonorRequest.findOne({
    searcher: searcherParentId,
    phase: { $in: ['active', 'awaiting_unlimited_confirmation', 'unlimited'] },
  });
}

/** A donor's pets eligible to answer a request of this species right now. */
async function getEligiblePets(ownerId, species) {
  return Pet.find({ owner: ownerId, species, donorStatus: 'active' }).sort({ createdAt: 1 });
}

/**
 * Candidate donor accounts for one pass: owners with at least one matching,
 * actively-donating pet, not already asked about this request, and not the
 * searcher themselves. Returns unique PetParent docs (never the same owner
 * twice, even if several of their pets match).
 *
 * Two matching modes:
 * - 'radius': geo distance from the searcher's point, capped at
 *   currentRadiusKm (or uncapped once phase is 'unlimited').
 * - 'text': a plain city/area name typed with no pin, matched against
 *   donors' own locationText — for sharing with people who haven't (or
 *   can't) share a precise location. No distance, so nothing to expand;
 *   every matching donor is already "in range" from the first pass.
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

/** Proactively asks every newly-in-range, not-yet-asked donor account to help — this is the only place a searcher's contact info is disclosed. */
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
    if (!conversation) continue; // no chat session on file for this donor yet — nothing to notify

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

/** Creates a radius search and runs the first (starting-radius) notification pass. Returns the status text to show the searcher. */
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
 * Creates a simple city/area text search — no pin, no radius to expand.
 * Matches every donor whose own locationText mentions the given area right
 * away (phase 'unlimited' from the start), then keeps periodically
 * re-scanning for newly-registered donors the same way an exhausted radius
 * search does, via the same cron tick.
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

/** Cron entry point for phase 'active': widen the radius, or ask the searcher to go unlimited once maxRadiusKm is reached. */
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

/** Cron entry point for phase 'unlimited': catches donors who registered or came into range since the last pass. */
async function reNotifyUnlimited(request) {
  request.nextExpansionAt = minutesFromNow(config.expansionIntervalMinutes);
  await request.save();
  await notifyNewDonorsInRadius(request);
}

async function stopRequest(request) {
  request.phase = 'stopped';
  request.nextExpansionAt = null;
  await request.save();
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cron entry point: closes out anything that's sat unresolved for 30 days
 * rather than leaving it open forever. Two independent things age out on
 * their own clock, since a search can run for weeks while individual
 * donors get asked at different points along the way:
 * - A whole search still active/unlimited 30 days after it started.
 * - One donor's individual ask, still 'pending' 30 days after THEY were notified.
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

/** A donor account answered its ask. On accept, this is the only place a donor's contact info is disclosed, and only to this request's searcher. */
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

/** Removes a queued ask for this request from an owner's conversation — used when they respond via the web UI instead of chat, so the bot doesn't ask again. */
async function clearPendingAsk(ownerParentId, requestId) {
  const owner = await PetParent.findById(ownerParentId);
  if (!owner) return;
  await Conversation.updateOne(
    { channel: owner.channel, externalUserId: owner.externalUserId },
    { $pull: { pendingDonorRequests: { requestId } } }
  );
}

/** "Sent" view: every search this PetParent has started, with full details of who's accepted so far. */
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

/** "Received" view: every request this PetParent's account has been asked about, plus their own eligible pets for any still-pending ones. */
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
