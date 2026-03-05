import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from './env';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - S3 Client
 * Used for:
 * - Document uploads
 * - Secure file storage
 * - Watermarked access
 */

if (
  !env.AWS_REGION ||
  !env.AWS_ACCESS_KEY_ID ||
  !env.AWS_SECRET_ACCESS_KEY ||
  !env.AWS_S3_BUCKET_NAME
) {
  throw new Error('AWS S3 environment variables are not properly configured');
}

export const s3Client = new S3Client({
  region: env.AWS_REGION,

  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },

  requestHandler: {
    requestTimeout: 5000,
  } as any,
});

export const BUCKET_NAME = env.AWS_S3_BUCKET_NAME;

/**
 * Validate S3 configuration
 */
export const checkS3Connection = async (): Promise<boolean> => {

  try {

    await s3Client.send(
      new HeadBucketCommand({
        Bucket: BUCKET_NAME,
      })
    );

    logger.info('☁️ S3 connected successfully');

    return true;

  } catch (error) {

    logger.error('❌ S3 connection failed', error);

    process.exit(1);

  }

};