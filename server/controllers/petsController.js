const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const Pet = require('../models/Pet');
const { storeDocument } = require('../services/documentStorageService');

const list = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const species = searchParams.get('species');
  const donorStatus = searchParams.get('donorStatus');
  const filter = {};
  if (species) filter.species = species;
  if (donorStatus) filter.donorStatus = donorStatus;
  const pets = await Pet.find(filter).populate('owner').sort({ createdAt: -1 }).limit(100);
  return NextResponse.json({ pets });
});

const create = apiHandler(async (req) => {
  const body = await req.json();
  const pet = await Pet.create(body);
  return NextResponse.json({ pet }, { status: 201 });
});

const get = apiHandler(async (req, { params }) => {
  const pet = await Pet.findById(params.id).populate('owner');
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
  return NextResponse.json({ pet });
});

const update = apiHandler(async (req, { params }) => {
  const body = await req.json();
  const pet = await Pet.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
  return NextResponse.json({ pet });
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
  // an inline data URL for now) and stores whatever URL it hands back.
  const stored = await storeDocument({ petId: params.id, filename, mimeType, dataUrl: url });

  const pet = await Pet.findByIdAndUpdate(
    params.id,
    { $push: { documents: { filename, mimeType, url: stored.url, sizeBytes, status: 'pending' } } },
    { new: true, runValidators: true }
  );
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
  return NextResponse.json({ pet }, { status: 201 });
});

const removeDocument = apiHandler(async (req, { params }) => {
  const pet = await Pet.findByIdAndUpdate(
    params.id,
    { $pull: { documents: { _id: params.docId } } },
    { new: true }
  );
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
  return NextResponse.json({ pet });
});

const updateDocumentStatus = apiHandler(async (req, { params }) => {
  const body = await req.json();
  const { status } = body;
  if (!['verified', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'status must be "verified" or "pending"' }, { status: 400 });
  }
  const pet = await Pet.findOneAndUpdate(
    { _id: params.id, 'documents._id': params.docId },
    { $set: { 'documents.$.status': status } },
    { new: true }
  );
  if (!pet) return NextResponse.json({ error: 'Pet or document not found' }, { status: 404 });
  return NextResponse.json({ pet });
});

module.exports = { list, create, get, update, addDocument, removeDocument, updateDocumentStatus };
