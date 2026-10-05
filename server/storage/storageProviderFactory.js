const inlineStorageProvider = require('./inlineStorageProvider');
const s3StorageProvider = require('./s3StorageProvider');
const { documentStorage } = require('../config/env');

const providers = { inline: inlineStorageProvider, s3: s3StorageProvider };

/**
 * Returns the document storage provider selected by DOCUMENT_STORAGE_PROVIDER.
 * @return {Object} The configured provider, or the inline provider if the
 *     setting is unknown.
 */
function getStorageProvider() {
  return providers[documentStorage.provider] || inlineStorageProvider;
}

module.exports = { getStorageProvider, inlineStorageProvider, s3StorageProvider };
