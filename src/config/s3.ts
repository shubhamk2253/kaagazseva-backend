import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from './env';

/**
 * KAAGAZSEVA - S3 Client
 * Used for:
 * - Document uploads
 * - Secure file storage
 * - Watermarked access
 */

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = env.AWS_S3_BUCKET_NAME;

/**
 * Validate S3 configuration
 */
export const checkS3Connection = async () => {
  try {
    if (!BUCKET_NAME) {
      throw new Error('Bucket name missing');
    }

    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));

    console.log('☁️ S3: Connected successfully');
  } catch (error) {
    console.error('❌ S3: Connection failed');
    console.error(error);
    process.exit(1);
  }
};