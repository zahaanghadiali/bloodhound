class StorageProvider {
  /**
   * Stores a file. Exactly one of the returned key and url is meaningful:
   * object storage returns a key and signs URLs on demand, while a provider
   * with no separate storage returns the url directly.
   * @param {{key: string, buffer: Buffer, mimeType: string}} file File to
   *     store.
   * @return {Promise<{key: ?string, url: ?string}>} Where the file was stored.
   * @throws {Error} Always, unless overridden by a subclass.
   */
  async upload({ key, buffer, mimeType }) {
    throw new Error('upload() not implemented');
  }

  /**
   * Creates a time-limited download URL. Only required for providers whose
   * upload returns a key.
   * @param {{key: string}} file Storage key of the file.
   * @return {Promise<string>} The signed URL.
   * @throws {Error} Always, unless overridden by a subclass.
   */
  async getSignedUrl({ key }) {
    throw new Error('getSignedUrl() not implemented');
  }

  /**
   * Deletes a stored file. Only required for providers whose upload returns a
   * key.
   * @param {{key: string}} file Storage key of the file.
   * @return {Promise<void>} Resolves once the file has been deleted.
   * @throws {Error} Always, unless overridden by a subclass.
   */
  async deleteObject({ key }) {
    throw new Error('deleteObject() not implemented');
  }
}

module.exports = StorageProvider;
