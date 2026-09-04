const inlineStorageProvider = require('./inlineStorageProvider');
const s3StorageProvider = require('./s3StorageProvider');
const { documentStorage } = require('../config/env');

const providers = { inline: inlineStorageProvider, s3: s3StorageProvider };

function getStorageProvider() {
  return providers[documentStorage.provider] || inlineStorageProvider;
}

module.exports = { getStorageProvider, inlineStorageProvider, s3StorageProvider };
