import {
  S3Client,
  HeadBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl }    from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { env, isDevelopment } from './env';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - S3 Client
 * Used for:
 * - Document uploads (application docs, KYC, proofs)
 * - Secure pre-signed URL access (never public URLs)
 * - Watermarked document storage
 */

/* =====================================================
   CONFIGURATION GUARD
===================================================== */

export const isS3Configured = !!(
  env.AWS_ACCESS_KEY_ID &&
  env.AWS_SECRET_ACCESS_KEY &&
  env.AWS_S3_BUCKET_NAME
);

/* =====================================================
   S3 CLIENT
===================================================== */

export const s3Client = new S3Client({
  region: env.AWS_REGION,

  credentials: isS3Configured
    ? {
        accessKeyId:     env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,

  requestHandler: new NodeHttpHandler({
    requestTimeout:    5000,  // 5s per request
    connectionTimeout: 3000,  // 3s to connect
  }),
});

export const BUCKET_NAME = env.AWS_S3_BUCKET_NAME || '';

/* =====================================================
   S3 KEY STRUCTURE
   Consistent naming for all stored files
===================================================== */

export const S3Keys = {
  // Customer uploaded documents
  applicationDocument: (applicationId: string, filename: string) =>
    `applications/${applicationId}/documents/${filename}`,

  // Agent completion proof photos
  completionProof: (applicationId: string, filename: string) =>
    `applications/${applicationId}/proof/${filename}`,

  // Government acknowledgment receipts
  govtReceipt: (applicationId: string, filename: string) =>
    `applications/${applicationId}/receipt/${filename}`,

  // Agent KYC documents
  agentKyc: (agentId: string, docType: string) =>
    `agents/${agentId}/kyc/${docType}`,

  // Watermarked versions of documents
  watermarked: (applicationId: string, filename: string) =>
    `applications/${applicationId}/watermarked/${filename}`,
};

/* =====================================================
   PRE-SIGNED URL HELPERS
   Never expose direct S3 URLs — always use signed URLs
===================================================== */

// Secure read URL — expires in 2 hours by default
export async function getPresignedReadUrl(
  key: string,
  expiresInSeconds: number = 7200
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key:    key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

// Secure upload URL — expires in 15 minutes
export async function getPresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresInSeconds: number = 900
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         key,
    ContentType: mimeType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

// Delete a file from S3
export async function deleteS3Object(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key:    key,
  }));
}

/* =====================================================
   HEALTH CHECK
   Returns boolean — never crashes server
===================================================== */

export async function isS3Healthy(): Promise<boolean> {
  if (!isS3Configured) {
    if (isDevelopment) return true; // skip in dev
    return false;
  }

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    logger.info({ event: 'S3_CONNECTED', bucket: BUCKET_NAME });
    return true;
  } catch (error) {
    logger.error({
      event:   'S3_CONNECTION_FAILED',
      bucket:  BUCKET_NAME,
      message: (error as Error).message,
    });
    return false;
  }
}