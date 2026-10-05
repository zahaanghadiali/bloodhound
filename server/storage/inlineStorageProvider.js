const StorageProvider = require('./storageProviderInterface');
const logger = require('../utils/logger');

class InlineStorageProvider extends StorageProvider {
  /**
   * Keeps a file as a base64 data URL instead of uploading it anywhere.
   * @param {{key: string, buffer: Buffer, mimeType: string}} file File to
   *     store.
   * @return {Promise<{key: null, url: string}>} The data URL; there is no
   *     storage key.
   */
  async upload({ key, buffer, mimeType }) {
    logger.info('inline document storage (no S3 configured)', { key, mimeType, bytes: buffer.length });
    return { key: null, url: `data:${mimeType};base64,${buffer.toString('base64')}` };
  }
}

module.exports = new InlineStorageProvider();
