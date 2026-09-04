/**
 * Contract every document storage provider must implement, mirroring the
 * OtpProvider pattern in server/otp/.
 *
 * upload({ key, buffer, mimeType }) -> Promise<{ key, url }>
 *   Exactly one of `key`/`url` is meaningful: a real object-storage
 *   provider (S3) returns `key` and leaves `url` null — the caller
 *   generates a signed URL on demand via getSignedUrl(). A provider with
 *   no separate storage (inline) returns `url` directly and no `key`.
 *
 * getSignedUrl({ key }) -> Promise<string>
 *   Only required for providers that return a `key` from upload().
 *
 * deleteObject({ key }) -> Promise<void>
 *   Only required for providers that return a `key` from upload().
 */
class StorageProvider {
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async upload({ key, buffer, mimeType }) {
    throw new Error('upload() not implemented');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async getSignedUrl({ key }) {
    throw new Error('getSignedUrl() not implemented');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async deleteObject({ key }) {
    throw new Error('deleteObject() not implemented');
  }
}

module.exports = StorageProvider;
