const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const StorageProvider = require('./storageProviderInterface');
const { aws } = require('../config/env');
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

/**
 * Uploads pet documents to S3. Configure via AWS_REGION, AWS_S3_BUCKET
 * (required), AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (omit both to fall
 * back to the default credential chain, e.g. an IAM role), and optionally
 * AWS_S3_PUBLIC_BASE_URL if a CDN sits in front of the bucket.
 */
class S3StorageProvider extends StorageProvider {
  // eslint-disable-next-line class-methods-use-this
  async upload({ key, buffer, mimeType }) {
    if (!aws.bucket) {
      throw new Error('AWS_S3_BUCKET is not set — cannot upload to S3.');
    }
    await getClient().send(
      new PutObjectCommand({ Bucket: aws.bucket, Key: key, Body: buffer, ContentType: mimeType })
    );
    const base = aws.publicBaseUrl || `https://${aws.bucket}.s3.${aws.region}.amazonaws.com`;
    logger.info('uploaded document to s3', { bucket: aws.bucket, key });
    return { url: `${base}/${key}` };
  }
}

module.exports = new S3StorageProvider();
