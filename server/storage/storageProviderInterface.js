/**
 * Contract every document storage provider must implement — one upload
 * method, mirroring the OtpProvider pattern in server/otp/.
 *
 * upload({ key, buffer, mimeType }) -> Promise<{ url }>
 */
class StorageProvider {
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async upload({ key, buffer, mimeType }) {
    throw new Error('upload() not implemented');
  }
}

module.exports = StorageProvider;
