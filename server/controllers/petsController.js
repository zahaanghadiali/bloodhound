const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const Pet = require('../models/Pet');
const PetParent = require('../models/PetParent');
const PetDocument = require('../models/PetDocument');
const { storeDocument, hydratePet, deleteDocument } = require('../services/documentStorageService');
const { findLinkedParentIds } = require('../services/identityService');

/**
 * Handles GET /api/pets: lists the caller's own pets, newest first.
 * @param {Request} req Request with optional species and donorStatus query
 *     params.
 * @return {Promise<Response>} JSON with up to 100 hydrated pets.
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

/**
 * Handles POST /api/pets: registers a pet owned by the caller.
 * @param {Request} req Request whose JSON body has the pet's fields.
 * @return {Promise<Response>} JSON with the new pet (201); 401 if the caller
 *     has not verified a phone number.
 * @throws {Error} If the pet fails schema validation.
 */
const create = apiHandler(async (req) => {
  const body = await req.json();
  const ownerId = req.headers.get('x-user-id');

  const owner = await PetParent.findById(ownerId);
  if (!owner || owner.deletedAt || !owner.phoneVerifiedAt) {
    return NextResponse.json({ error: 'Verify your phone number before registering a pet' }, { status: 401 });
  }

  delete body.photoKey;
  const pet = await Pet.create({ ...body, owner: ownerId });
  return NextResponse.json({ pet: await hydratePet(pet) }, { status: 201 });
});

/**
 * Loads a pet and checks it belongs to the signed-in pet parent.
 * @param {string} id Pet id.
 * @param {string} userId Id of the signed-in pet parent.
 * @return {Promise<{pet: (Object|undefined), error: (Response|undefined)}>} The
 *     pet, or a 404/403 error response to return to the client.
 */
async function requireOwnedPet(id, userId) {
  const pet = await Pet.findById(id).populate('owner');
  if (!pet) return { error: NextResponse.json({ error: 'Pet not found' }, { status: 404 }) };
  const ownerIds = await findLinkedParentIds(userId);
  if (!ownerIds.includes(String(pet.owner?._id || pet.owner))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { pet };
}

/**
 * Handles GET /api/pets/:id.
 * @param {Request} req Request carrying the x-user-id header.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON with the pet and its documents, or a 404/403
 *     error.
 */
const get = apiHandler(async (req, { params }) => {
  const { pet, error } = await requireOwnedPet(params.id, req.headers.get('x-user-id'));
  if (error) return error;
  return NextResponse.json({ pet: await hydratePet(pet, { withDocuments: true }) });
});

/**
 * Handles PATCH /api/pets/:id. The owner and photo storage key cannot be
 * changed through this endpoint.
 * @param {Request} req Request whose JSON body has the fields to change.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON with the updated pet, or a 404/403 error.
 * @throws {Error} If the update fails schema validation.
 */
const update = apiHandler(async (req, { params }) => {
  const { error } = await requireOwnedPet(params.id, req.headers.get('x-user-id'));
  if (error) return error;
  const body = await req.json();
  delete body.owner;
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

/**
 * Handles POST /api/pets/:id/documents: stores an uploaded medical document
 * with the configured storage provider and records it as pending.
 * @param {Request} req Request whose JSON body has filename, mimeType, url (a
 *     data URL) and optional sizeBytes.
 * @param {{params: {id: string}}} ctx Route params.
 * @return {Promise<Response>} JSON with the pet and its documents (201); 400
 *     for missing fields, an unsupported type or a file over 10 MB; 404/403 if
 *     the pet is not the caller's.
 * @throws {Error} If the storage provider fails to store the file.
 */
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

/**
 * Handles DELETE /api/pets/:id/documents/:docId. Removing the stored file is
 * best-effort and never blocks the delete.
 * @param {Request} req Request carrying the x-user-id header.
 * @param {{params: {id: string, docId: string}}} ctx Route params.
 * @return {Promise<Response>} JSON with the pet and its remaining documents, or
 *     a 404/403 error.
 */
const removeDocument = apiHandler(async (req, { params }) => {
  const { pet, error } = await requireOwnedPet(params.id, req.headers.get('x-user-id'));
  if (error) return error;

  const doc = await PetDocument.findOneAndDelete({ _id: params.docId, pet: pet._id });

  if (doc) await deleteDocument(doc).catch(() => {});

  return NextResponse.json({ pet: await hydratePet(pet, { withDocuments: true }) });
});

/**
 * Handles PATCH /api/pets/:id/documents/:docId: sets a document's review
 * status.
 * @param {Request} req Request whose JSON body has status ('verified' or
 *     'pending').
 * @param {{params: {id: string, docId: string}}} ctx Route params.
 * @return {Promise<Response>} JSON with the pet and its documents; 400 for an
 *     invalid status, 404 if the document does not exist, 404/403 if the pet is
 *     not the caller's.
 */
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
