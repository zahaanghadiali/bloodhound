const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const DonorRequest = require('../models/DonorRequest');
const donorRequestService = require('../services/donorRequestService');

/**
 * Web UI equivalent of the bot's donor-request flow. Every handler scopes
 * to the caller's own session (x-user-id, set by proxy.js from the verified
 * JWT) — never a searcher/owner id supplied by the client — matching the
 * ownership rules already enforced on /api/pets and /api/pet-parents.
 */

const listSent = apiHandler(async (req) => {
  const list = await donorRequestService.listSentForSearcher(req.headers.get('x-user-id'));
  return NextResponse.json({ requests: list });
});

const stopSent = apiHandler(async (req, { params }) => {
  const request = await DonorRequest.findById(params.id);
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  if (String(request.searcher) !== req.headers.get('x-user-id')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await donorRequestService.stopRequest(request);
  return NextResponse.json({ ok: true });
});

const listReceived = apiHandler(async (req) => {
  const list = await donorRequestService.listReceivedForOwner(req.headers.get('x-user-id'));
  return NextResponse.json({ requests: list });
});

const respond = apiHandler(async (req, { params }) => {
  const userId = req.headers.get('x-user-id');
  const body = await req.json();
  const { accepted, petId } = body;

  const request = await DonorRequest.findById(params.id);
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const entry = request.notifiedOwners.find((n) => String(n.owner) === userId);
  if (!entry) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (entry.status !== 'pending') {
    return NextResponse.json({ error: 'You already responded to this request' }, { status: 409 });
  }

  let chosenPetId = null;
  if (accepted) {
    const eligible = await donorRequestService.getEligiblePets(userId, request.species);
    if (eligible.length === 0) {
      return NextResponse.json({ error: "You don't have an eligible pet for this request" }, { status: 400 });
    }
    const match = petId ? eligible.find((p) => String(p._id) === petId) : eligible.length === 1 ? eligible[0] : null;
    if (!match) return NextResponse.json({ error: 'Please choose which pet is donating' }, { status: 400 });
    chosenPetId = match._id;
  }

  await donorRequestService.recordDonorResponse(request, userId, { accepted: !!accepted, petId: chosenPetId });
  // The bot may also have this queued — clear it so it isn't asked again on the next chat message.
  await donorRequestService.clearPendingAsk(userId, request._id);

  return NextResponse.json({ ok: true });
});

module.exports = { listSent, stopSent, listReceived, respond };
