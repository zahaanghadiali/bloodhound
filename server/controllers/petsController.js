const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const Pet = require('../models/Pet');
const PetParent = require('../models/PetParent');
const PetDocument = require('../models/PetDocument');
const { storeDocument, hydratePet, deleteDocument } = require('../services/documentStorageService');
const { findLinkedParentIds } = require('../services/identityService');

/**
 * A pet's `owner` always resolves to the caller's own PetParent id
 * (x-user-id, set by proxy.js from the verified session JWT) — never to an
 * `owner` value supplied by the client — so one signed-in parent can't
 * list, read, or write another parent's pets by guessing/passing an id.
 * Reads and edits also cover the caller's linked accounts (same verified
 * phone on another channel — see findLinkedParentIds), so pets registered
 * over WhatsApp show up when that person signs in on the web.
 */

const list = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const species = searchParams.get('species');
  const donorStatus = searchParams.get('donorStatus');
  const filter = { owner: { $in: await findLinkedParentIds(req.headers.get('x-user-id')) } };
  if (species) filter.species = species;
  if (donorStatus) filter.donorStatus = donorStatus;
  const pets = await Pet.find(filter).populate('owner').sort({ createdAt: -1 }).limit(100);
  return NextResponse.json({ pets: await Promise.all(pets.map((pet) => hydratePet(pet))) });
});

const create = apiHandler(async (req) => {
  const body = await req.json();
  const ownerId = req.headers.get('x-user-id');

  const owner = await PetParent.findById(ownerId);
  if (!owner || owner.deletedAt || !owner.phoneVerifiedAt) {
    return NextResponse.json({ error: 'Verify your phone number before registering a pet' }, { status: 401 });
  }

  delete body.photoKey; // storage keys are only ever set server-side
  const pet = await Pet.create({ ...body, owner: ownerId });
  return NextResponse.json({ pet: await hydratePet(pet) }, { status: 201 });
});

async function requireOwnedPet(id, userId) {
  const pet = await Pet.findById(id).populate('owner');
  if (!pet) return { error: NextResponse.json({ error: 'Pet not found' }, { status: 404 }) };
  const ownerIds = await findLinkedParentIds(userId);
  if (!ownerIds.includes(String(pet.owner?._id || pet.owner))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { pet };
}

const get = apiHandler(async (req, { params }) => {
  const { pet, error } = await requireOwnedPet(params.id, req.headers.get('x-user-id'));
  if (error) return error;
  return NextResponse.json({ pet: await hydratePet(pet, { withDocuments: true }) });
});

const update = apiHandler(async (req, { params }) => {
  const { error } = await requireOwnedPet(params.id, req.headers.get('x-user-id'));
  if (error) return error;
  const body = await req.json();
  delete body.owner; // ownership is immutable via this endpoint
  // Storage keys are only ever set server-side — a client-supplied one
  // could point at another pet's file and get a signed URL for it.
  delete body.photoKey;
  const pet = await Pet.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
  return NextResponse.json({ pet: await hydratePet(pet) });
});

const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
];
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const addDocument = apiHandler(async (req, { params }) => {
  const { pet, error } = await requireOwnedPet(params.id, req.headers.get('x-user-id'));
  if (error) return error;

  const body = await req.json();
  const { filename, mimeType, url, sizeBytes } = body;

  if (!filename || !mimeType || !url) {
    return NextResponse.json({ error: 'filename, mimeType and url are required' }, { status: 400 });
  }
  if (!ACCEPTED_DOCUMENT_TYPES.includes(mimeType)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }
  if (typeof sizeBytes === 'number' && sizeBytes > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: 'File is too large' }, { status: 400 });
  }

  // Hands the file off to the configured storage provider (S3 once set up,
  // an inline data URL for now) and stores whichever of {key, url} it
  // hands back — never a permanent URL for an S3-backed document.
  const stored = await storeDocument({ petId: params.id, category: 'documents', filename, mimeType, dataUrl: url });

  await PetDocument.create({
    pet: pet._id,
    owner: pet.owner?._id || pet.owner,
    filename,
    mimeType,
    storageKey: stored.key || undefined,
    url: stored.url || undefined,
    sizeBytes,
    status: 'pending',
  });
  return NextResponse.json({ pet: await hydratePet(pet, { withDocuments: true }) }, { status: 201 });
});

const removeDocument = apiHandler(async (req, { params }) => {
  const { pet, error } = await requireOwnedPet(params.id, req.headers.get('x-user-id'));
  if (error) return error;

  const doc = await PetDocument.findOneAndDelete({ _id: params.docId, pet: pet._id });

  // Best-effort — the Mongo write above already succeeded either way, so a
  // failure here just leaves an orphaned object in the bucket rather than
  // blocking the delete the user asked for.
  if (doc) await deleteDocument(doc).catch(() => {});

  return NextResponse.json({ pet: await hydratePet(pet, { withDocuments: true }) });
});

const updateDocumentStatus = apiHandler(async (req, { params }) => {
  const { pet, error } = await requireOwnedPet(params.id, req.headers.get('x-user-id'));
  if (error) return error;

  const body = await req.json();
  const { status } = body;
  if (!['verified', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'status must be "verified" or "pending"' }, { status: 400 });
  }
  const doc = await PetDocument.findOneAndUpdate({ _id: params.docId, pet: pet._id }, { $set: { status } });
  if (!doc) return NextResponse.json({ error: 'Pet or document not found' }, { status: 404 });
  return NextResponse.json({ pet: await hydratePet(pet, { withDocuments: true }) });
});

module.exports = { list, create, get, update, addDocument, removeDocument, updateDocumentStatus };
