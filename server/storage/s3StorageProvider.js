const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: presign } = require('@aws-sdk/s3-request-presigner');
const StorageProvider = require('./storageProviderInterface');
const { aws, documentStorage } = require('../config/env');
const logger = require('../utils/logger');

let s3Client = null;

function getClient() {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: aws.region,
    credentials: aws.accessKeyId ? { accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey } : undefined,
  });
  return s3Client;
}

function requireBucket() {
  if (!aws.bucket) throw new Error('AWS_S3_BUCKET is not set — cannot use S3 document storage.');
}

/**
 * Stores pet documents in a **private** S3 bucket — no ACL, no public URL.
 * Configure via AWS_REGION, AWS_S3_BUCKET (required), and
 * AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (omit both to fall back to the
 * default credential chain, e.g. an IAM role). Reads go through
 * getSignedUrl(), which mints a time-limited URL (DOCUMENT_SIGNED_URL_TTL_SECONDS)
 * instead of exposing medical records at a permanent public link.
 */
class S3StorageProvider extends StorageProvider {
  // eslint-disable-next-line class-methods-use-this
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

  // eslint-disable-next-line class-methods-use-this
  async getSignedUrl({ key }) {
    requireBucket();
    const command = new GetObjectCommand({ Bucket: aws.bucket, Key: key });
    return presign(getClient(), command, { expiresIn: documentStorage.signedUrlTtlSeconds });
  }

  // eslint-disable-next-line class-methods-use-this
  async deleteObject({ key }) {
    requireBucket();
    await getClient().send(new DeleteObjectCommand({ Bucket: aws.bucket, Key: key }));
    logger.info('deleted document from s3', { bucket: aws.bucket, key });
  }
}

module.exports = new S3StorageProvider();
