const crypto = require('crypto');
const { getStorageProvider } = require('../storage/storageProviderFactory');
const PetDocument = require('../models/PetDocument');
const logger = require('../utils/logger');

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Expected a base64 data URL');
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

/** Strips path separators and anything but safe filename characters, so a client-supplied filename can't smuggle extra "/" segments into the S3 key. */
function sanitizeFilename(filename) {
  const base = String(filename || 'file').replace(/[/\\]/g, '_').replace(/[^A-Za-z0-9._-]/g, '_');
  return base.slice(-140) || 'file';
}

/**
 * Bucket layout: pets/{petId}/{category}/{uuid}-{filename}
 *   - `petId` is the pet's Mongo ObjectId, so every asset for a pet lives
 *     under one prefix.
 *   - `category` is 'documents' for medical records, 'pictures' for the
 *     pet's profile photo (see storePetPhoto).
 *   - the uuid prefix avoids collisions/overwrites and stops filenames
 *     from being guessable.
 * No dev/staging/prod prefix — separate environments get separate buckets
 * instead (via AWS_S3_BUCKET), so this is just what a real deployment's
 * pets/ layout looks like.
 */
function buildKey({ petId, category, filename }) {
  return `pets/${petId}/${category}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

/**
 * Stores one pet document (uploaded as a base64 data URL by the client) via
 * the configured storage provider — S3 once DOCUMENT_STORAGE_PROVIDER=s3
 * and the AWS_* env vars are set, kept as an inline data URL otherwise —
 * and returns whichever of {key, url} the Pet document should save.
 */
async function storeDocument({ petId, category = 'documents', filename, mimeType, dataUrl }) {
  const { buffer } = parseDataUrl(dataUrl);
  const key = buildKey({ petId, category, filename });
  const provider = getStorageProvider();
  return provider.upload({ key, buffer, mimeType });
}

const PHOTO_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic' };

/**
 * Stores a pet's profile photo (the base64 data URL the chat flow collected)
 * under pets/{petId}/pictures/ and returns whichever of {key, url} the Pet
 * should save as photoKey / photoUrl.
 */
async function storePetPhoto(petId, dataUrl) {
  const { mimeType } = parseDataUrl(dataUrl);
  const filename = `photo.${PHOTO_EXTENSIONS[mimeType] || 'jpg'}`;
  return storeDocument({ petId, category: 'pictures', filename, mimeType, dataUrl });
}

/** Resolves one PetDocument to a URL the client can load right now — a fresh signed URL for S3-backed documents (storageKey set), or the stored data URL for inline ones. */
async function resolveDocumentUrl(doc) {
  if (!doc) return null;
  if (!doc.storageKey) return doc.url || null;
  const provider = getStorageProvider();
  return provider.getSignedUrl({ key: doc.storageKey });
}

/** A pet's medical records, oldest first. */
async function listPetDocuments(petId) {
  return PetDocument.find({ pet: petId }).sort({ uploadedAt: 1 });
}

/**
 * Returns a plain object copy of `pet` ready to send to the client: an
 * S3-backed photo gets a freshly signed `photoUrl` (the stored `photoKey`
 * itself never leaves the server), and with `withDocuments` the pet's
 * medical records are attached as `documents`, each with a `url` that's
 * loadable right now.
 */
async function hydratePet(pet, { withDocuments = false } = {}) {
  if (!pet) return pet;
  const obj = typeof pet.toObject === 'function' ? pet.toObject() : { ...pet };

  if (obj.photoKey) {
    // A photo that can't be signed shouldn't take the whole pet down with
    // it — the UI falls back to the species icon.
    obj.photoUrl = await getStorageProvider()
      .getSignedUrl({ key: obj.photoKey })
      .catch((err) => {
        logger.error('could not sign pet photo url', { petId: String(obj._id), error: err.message });
        return null;
      });
  }
  delete obj.photoKey;

  if (withDocuments) {
    const docs = await PetDocument.find({ pet: obj._id }).sort({ uploadedAt: 1 }).lean();
    obj.documents = await Promise.all(docs.map(async (doc) => ({ ...doc, url: await resolveDocumentUrl(doc) })));
  }
  return obj;
}

/** Deletes the underlying object for a PetDocument, if it has one (S3-backed only — inline documents have nothing to delete). */
async function deleteDocument(doc) {
  if (!doc?.storageKey) return;
  const provider = getStorageProvider();
  await provider.deleteObject({ key: doc.storageKey });
}

module.exports = { storeDocument, storePetPhoto, resolveDocumentUrl, listPetDocuments, hydratePet, deleteDocument };
