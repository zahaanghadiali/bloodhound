const StorageProvider = require('./storageProviderInterface');
const logger = require('../utils/logger');

/**
 * Local/testing provider — no object storage involved. Documents are kept
 * as base64 data URLs directly on the Pet document, the same way pet
 * photos already are. Set DOCUMENT_STORAGE_PROVIDER=s3 (with the AWS_*
 * env vars) to upload to S3 instead, without touching any call sites.
 */
class InlineStorageProvider extends StorageProvider {
  // eslint-disable-next-line class-methods-use-this
  async upload({ key, buffer, mimeType }) {
    logger.info('inline document storage (no S3 configured)', { key, mimeType, bytes: buffer.length });
    return { url: `data:${mimeType};base64,${buffer.toString('base64')}` };
  }
}

module.exports = new InlineStorageProvider();
