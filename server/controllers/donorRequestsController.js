const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const DonorRequest = require('../models/DonorRequest');
const donorRequestService = require('../services/donorRequestService');
const { findLinkedParentIds } = require('../services/identityService');

/**
 * Handles GET /api/donor-requests/sent: lists the caller's own donor searches.
 * @param {Request} req Request carrying the x-user-id header.
 * @return {Promise<Response>} JSON with the requests.
 */

const listSent = apiHandler(async (req) => {
  const list = await donorRequestService.listSentForSearcher(await findLinkedParentIds(req.headers.get('x-user-id')));
  return NextResponse.json({ requests: list });
});

/**
 * Handles POST /api/donor-requests/sent/:id/stop: stops one of the caller's
 * donor searches.
 * @param {Request} req Request carrying the x-user-id header.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON confirmation; 404 if the request does not
 *     exist, 403 if it belongs to someone else.
 */
const stopSent = apiHandler(async (req, { params }) => {
  const request = await DonorRequest.findById(params.id);
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  const userIds = await findLinkedParentIds(req.headers.get('x-user-id'));
  if (!userIds.includes(String(request.searcher))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await donorRequestService.stopRequest(request);
  return NextResponse.json({ ok: true });
});

/**
 * Handles GET /api/donor-requests/received: lists donor requests the caller was
 * notified about.
 * @param {Request} req Request carrying the x-user-id header.
 * @return {Promise<Response>} JSON with the requests.
 */
const listReceived = apiHandler(async (req) => {
  const list = await donorRequestService.listReceivedForOwner(await findLinkedParentIds(req.headers.get('x-user-id')));
  return NextResponse.json({ requests: list });
});

/**
 * Handles POST /api/donor-requests/received/:id/respond: records the caller's
 * accept or decline, and which pet is donating.
 * @param {Request} req Request whose JSON body has accepted and optional petId.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON confirmation; 404 if the request does not
 *     exist, 403 if the caller was never notified, 409 if already answered, 400
 *     if no eligible pet can be determined.
 */
const respond = apiHandler(async (req, { params }) => {
  const userIds = await findLinkedParentIds(req.headers.get('x-user-id'));
  const body = await req.json();
  const { accepted, petId } = body;

  const request = await DonorRequest.findById(params.id);
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const entry = donorRequestService.findOwnAsk(request, userIds);
  if (!entry) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (entry.status !== 'pending') {
    return NextResponse.json({ error: 'You already responded to this request' }, { status: 409 });
  }

  let chosenPetId = null;
  if (accepted) {
    const eligible = await donorRequestService.getEligiblePets(userIds, request.species);
    if (eligible.length === 0) {
      return NextResponse.json({ error: "You don't have an eligible pet for this request" }, { status: 400 });
    }
    const match = petId ? eligible.find((p) => String(p._id) === petId) : eligible.length === 1 ? eligible[0] : null;
    if (!match) return NextResponse.json({ error: 'Please choose which pet is donating' }, { status: 400 });
    chosenPetId = match._id;
  }

  // The ask belongs to whichever linked account was notified — respond as that one.
  const ownerId = String(entry.owner);
  await donorRequestService.recordDonorResponse(request, ownerId, { accepted: !!accepted, petId: chosenPetId });
  await donorRequestService.clearPendingAsk(ownerId, request._id);

  return NextResponse.json({ ok: true });
});

module.exports = { listSent, stopSent, listReceived, respond };
