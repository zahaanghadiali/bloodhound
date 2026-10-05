const crypto = require('crypto');
const { getStorageProvider } = require('../storage/storageProviderFactory');
const PetDocument = require('../models/PetDocument');
const logger = require('../utils/logger');

/**
 * Splits a base64 data URL into its mime type and bytes.
 * @param {string} dataUrl Data URL such as "data:image/png;base64,...".
 * @return {{mimeType: string, buffer: Buffer}} The decoded contents.
 * @throws {Error} If the value is not a base64 data URL.
 */
function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Expected a base64 data URL');
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

/**
 * Replaces path separators and unsafe characters in a filename, so a
 * client-supplied name cannot add extra segments to a storage key.
 * @param {?string} filename Client-supplied filename.
 * @return {string} A safe name of at most 140 characters; 'file' if empty.
 */
function sanitizeFilename(filename) {
  const base = String(filename || 'file').replace(/[/\\]/g, '_').replace(/[^A-Za-z0-9._-]/g, '_');
  return base.slice(-140) || 'file';
}

/**
 * Builds a storage key of the form pets/{petId}/{category}/{uuid}-{filename}.
 * The uuid avoids collisions and keeps filenames from being guessable.
 * @param {{petId: (string|Object), category: string, filename: string}} file
 *     Pet id, category ('documents' or 'pictures') and original filename.
 * @return {string} The storage key.
 */
function buildKey({ petId, category, filename }) {
  return `pets/${petId}/${category}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

/**
 * Stores one uploaded pet file through the configured storage provider.
 * @param {{petId: (string|Object), category: (string|undefined), filename:
 *     string, mimeType: string, dataUrl: string}} file File to store; category
 *     defaults to 'documents'.
 * @return {Promise<{key: ?string, url: ?string}>} Whichever of key (object
 *     storage) or url (inline data URL) should be saved.
 * @throws {Error} If dataUrl is not a base64 data URL or the upload fails.
 */
async function storeDocument({ petId, category = 'documents', filename, mimeType, dataUrl }) {
  const { buffer } = parseDataUrl(dataUrl);
  const key = buildKey({ petId, category, filename });
  const provider = getStorageProvider();
  return provider.upload({ key, buffer, mimeType });
}

const PHOTO_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic' };

/**
 * Stores a pet's profile photo under pets/{petId}/pictures/.
 * @param {string|Object} petId Id of the pet.
 * @param {string} dataUrl Photo as a base64 data URL.
 * @return {Promise<{key: ?string, url: ?string}>} Whichever of key or url
 *     should be saved as the pet's photoKey or photoUrl.
 * @throws {Error} If dataUrl is not a base64 data URL or the upload fails.
 */
async function storePetPhoto(petId, dataUrl) {
  const { mimeType } = parseDataUrl(dataUrl);
  const filename = `photo.${PHOTO_EXTENSIONS[mimeType] || 'jpg'}`;
  return storeDocument({ petId, category: 'pictures', filename, mimeType, dataUrl });
}

/**
 * Resolves a pet document to a URL the client can load right now: a freshly
 * signed URL for a stored object, or the saved data URL for an inline document.
 * @param {?Object} doc PetDocument record.
 * @return {Promise<?string>} The URL, or null if there is no document or URL.
 * @throws {Error} If the storage provider fails to sign the URL.
 */
async function resolveDocumentUrl(doc) {
  if (!doc) return null;
  if (!doc.storageKey) return doc.url || null;
  const provider = getStorageProvider();
  return provider.getSignedUrl({ key: doc.storageKey });
}

/**
 * Lists a pet's medical records, oldest first.
 * @param {string|Object} petId Id of the pet.
 * @return {Promise<Array<Object>>} The pet's PetDocument records.
 */
async function listPetDocuments(petId) {
  return PetDocument.find({ pet: petId }).sort({ uploadedAt: 1 });
}

/**
 * Builds a plain-object copy of a pet that is ready to send to the client. A
 * stored photo gets a freshly signed photoUrl and the photoKey is removed; a
 * photo that cannot be signed becomes null rather than failing the pet.
 * @param {?Object} pet Pet document or plain object.
 * @param {{withDocuments: (boolean|undefined)}=} options Set withDocuments to
 *     attach the pet's medical records as `documents`, each with a loadable
 *     url.
 * @return {Promise<?Object>} The hydrated pet, or the input unchanged when it
 *     is null or undefined.
 * @throws {Error} If a document URL cannot be signed.
 */
async function hydratePet(pet, { withDocuments = false } = {}) {
  if (!pet) return pet;
  const obj = typeof pet.toObject === 'function' ? pet.toObject() : { ...pet };

  if (obj.photoKey) {
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

/**
 * Deletes the stored object behind a pet document. Inline documents have no
 * separate object, so nothing happens for them.
 * @param {?Object} doc PetDocument record.
 * @return {Promise<void>} Resolves once the object has been deleted.
 * @throws {Error} If the storage provider fails to delete the object.
 */
async function deleteDocument(doc) {
  if (!doc?.storageKey) return;
  const provider = getStorageProvider();
  await provider.deleteObject({ key: doc.storageKey });
}

module.exports = { storeDocument, storePetPhoto, resolveDocumentUrl, listPetDocuments, hydratePet, deleteDocument };
