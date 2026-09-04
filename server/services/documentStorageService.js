const crypto = require('crypto');
const { getStorageProvider } = require('../storage/storageProviderFactory');

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
 *   - `category` is 'documents' today (medical records); 'pictures' is
 *     reserved for when pet profile photos move off inline base64 too.
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

/** Resolves one document sub-doc to a URL the client can load right now — a fresh signed URL for S3-backed documents (storageKey set), or the stored data URL for inline ones. */
async function resolveDocumentUrl(doc) {
  if (!doc) return null;
  if (!doc.storageKey) return doc.url || null;
  const provider = getStorageProvider();
  return provider.getSignedUrl({ key: doc.storageKey });
}

/** Returns a plain object copy of `pet` with every document's `url` resolved to something loadable right now. */
async function hydratePetDocuments(pet) {
  if (!pet) return pet;
  const obj = typeof pet.toObject === 'function' ? pet.toObject() : pet;
  obj.documents = await Promise.all(
    (obj.documents || []).map(async (doc) => ({ ...doc, url: await resolveDocumentUrl(doc) }))
  );
  return obj;
}

/** Deletes the underlying object for a document sub-doc, if it has one (S3-backed only — inline documents have nothing to delete). */
async function deleteDocument(doc) {
  if (!doc?.storageKey) return;
  const provider = getStorageProvider();
  await provider.deleteObject({ key: doc.storageKey });
}

module.exports = { storeDocument, resolveDocumentUrl, hydratePetDocuments, deleteDocument };
