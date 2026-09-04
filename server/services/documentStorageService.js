const crypto = require('crypto');
const { getStorageProvider } = require('../storage/storageProviderFactory');

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Expected a base64 data URL');
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

/**
 * Stores one pet document (uploaded as a base64 data URL by the client) via
 * the configured storage provider — S3 once DOCUMENT_STORAGE_PROVIDER=s3
 * and the AWS_* env vars are set, an inline data URL on the Pet document
 * otherwise — and returns the URL to save on the pet's `documents` array.
 */
async function storeDocument({ petId, filename, mimeType, dataUrl }) {
  const { buffer } = parseDataUrl(dataUrl);
  const key = `pets/${petId}/documents/${crypto.randomUUID()}-${filename}`;
  const provider = getStorageProvider();
  return provider.upload({ key, buffer, mimeType });
}

module.exports = { storeDocument };
