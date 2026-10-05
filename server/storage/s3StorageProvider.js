const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: presign } = require('@aws-sdk/s3-request-presigner');
const StorageProvider = require('./storageProviderInterface');
const { aws, documentStorage } = require('../config/env');
const logger = require('../utils/logger');

let s3Client = null;

/**
 * Returns the shared S3 client, creating it on first use. Without explicit keys
 * it falls back to the default AWS credential chain.
 * @return {Object} The S3 client.
 */
function getClient() {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: aws.region,
    credentials: aws.accessKeyId ? { accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey } : undefined,
  });
  return s3Client;
}

/**
 * Asserts that an S3 bucket is configured.
 * @throws {Error} If AWS_S3_BUCKET is not set.
 */
function requireBucket() {
  if (!aws.bucket) throw new Error('AWS_S3_BUCKET is not set — cannot use S3 document storage.');
}

class S3StorageProvider extends StorageProvider {
  /**
   * Uploads a file to the private S3 bucket with server-side encryption.
   * @param {{key: string, buffer: Buffer, mimeType: string}} file File to
   *     store.
   * @return {Promise<{key: string, url: null}>} The storage key; URLs are
   *     signed on demand.
   * @throws {Error} If the bucket is not configured or the upload fails.
   */
  async upload({ key, buffer, mimeType }) {
    requireBucket();
    await getClient().send(
      new PutObjectCommand({
        Bucket: aws.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256',
      })
    );
    logger.info('uploaded document to s3', { bucket: aws.bucket, key });
    return { key, url: null };
  }

  /**
   * Creates a time-limited download URL for a stored file.
   * @param {{key: string}} file Storage key of the file.
   * @return {Promise<string>} URL valid for DOCUMENT_SIGNED_URL_TTL_SECONDS.
   * @throws {Error} If the bucket is not configured or signing fails.
   */
  async getSignedUrl({ key }) {
    requireBucket();
    const command = new GetObjectCommand({ Bucket: aws.bucket, Key: key });
    return presign(getClient(), command, { expiresIn: documentStorage.signedUrlTtlSeconds });
  }

  /**
   * Deletes a stored file from the bucket.
   * @param {{key: string}} file Storage key of the file.
   * @return {Promise<void>} Resolves once the object has been deleted.
   * @throws {Error} If the bucket is not configured or the delete fails.
   */
  async deleteObject({ key }) {
    requireBucket();
    await getClient().send(new DeleteObjectCommand({ Bucket: aws.bucket, Key: key }));
    logger.info('deleted document from s3', { bucket: aws.bucket, key });
  }
}

module.exports = new S3StorageProvider();
