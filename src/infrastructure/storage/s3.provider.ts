import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl }          from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, S3Keys } from '../../config/s3';
import { AppError }              from '../../core/AppError';
import logger                    from '../../core/logger';
import { SYSTEM_LIMITS, SECURITY } from '../../core/constants';
import { randomUUID }            from 'crypto';

/**
 * KAAGAZSEVA - Secure S3 Storage Provider
 * All document storage goes through this class.
 * Documents are NEVER publicly accessible.
 * Access only via pre-signed URLs with expiry.
 */

export class S3Provider {

  /* =====================================================
     ALLOWED FILE TYPES
  ===================================================== */

  private static readonly ALLOWED_TYPES: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg':      'jpg',
    'image/png':       'png',
    'image/webp':      'webp', // modern mobile cameras
  };

  /* =====================================================
     UPLOAD FILE
     Returns S3 key — never a public URL
     Caller must verify file count before calling
  ===================================================== */

  static async uploadFile(
    file:          Express.Multer.File,
    folder:        string,
    userId?:       string,
    applicationId?: string
  ): Promise<{ key: string; size: number; mimeType: string }> {

    // Size validation
    const maxSizeBytes = SYSTEM_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new AppError(
        `File exceeds ${SYSTEM_LIMITS.MAX_FILE_SIZE_MB}MB limit`,
        400, true, 'FILE_TOO_LARGE'
      );
    }

    // Type validation
    const extension = this.ALLOWED_TYPES[file.mimetype];

    if (!extension) {
      throw new AppError(
        `Unsupported file type: ${file.mimetype}. ` +
        `Allowed: PDF, JPEG, PNG, WebP`,
        400, true, 'FILE_TYPE_NOT_ALLOWED'
      );
    }

    // Build S3 key using consistent structure
    const filename = `${randomUUID()}.${extension}`;
    const key = applicationId
      ? S3Keys.applicationDocument(applicationId, filename)
      : `${folder}/${userId || 'system'}/${filename}`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket:             BUCKET_NAME,
        Key:                key,
        Body:               file.buffer,
        ContentType:        file.mimetype,
        ContentLength:      file.size,
        ContentDisposition: 'inline',
        ServerSideEncryption: 'AES256', // encrypt at rest

        Metadata: {
          uploadedBy:    userId       || 'system',
          applicationId: applicationId || 'none',
          originalName:  file.originalname,
          uploadedAt:    new Date().toISOString(),
        },
      }));

      logger.info({
        event: 'S3_UPLOAD_SUCCESS',
        key,
        size: file.size,
        type: file.mimetype,
      });

      return {
        key,
        size:     file.size,
        mimeType: file.mimetype,
      };

    } catch (error: any) {
      logger.error({
        event: 'S3_UPLOAD_FAILED',
        key,
        error: error.message,
      });

      throw new AppError(
        'Failed to upload document to storage',
        500, true, 'S3_UPLOAD_FAILED'
      );
    }
  }

  /* =====================================================
     UPLOAD COMPLETION PROOF
     Specific method for agent completion photos
  ===================================================== */

  static async uploadCompletionProof(
    file:          Express.Multer.File,
    applicationId: string,
    agentId:       string
  ): Promise<{ key: string }> {

    const extension = this.ALLOWED_TYPES[file.mimetype];
    if (!extension) {
      throw new AppError(
        'Unsupported file type for proof',
        400, true, 'FILE_TYPE_NOT_ALLOWED'
      );
    }

    const filename = `${randomUUID()}.${extension}`;
    const key      = S3Keys.completionProof(applicationId, filename);

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket:               BUCKET_NAME,
        Key:                  key,
        Body:                 file.buffer,
        ContentType:          file.mimetype,
        ContentLength:        file.size,
        ContentDisposition:   'inline',
        ServerSideEncryption: 'AES256',
        Metadata: {
          uploadedBy:    agentId,
          applicationId,
          type:          'completion_proof',
          uploadedAt:    new Date().toISOString(),
        },
      }));

      logger.info({ event: 'S3_PROOF_UPLOADED', key, applicationId });
      return { key };

    } catch (error: any) {
      logger.error({ event: 'S3_PROOF_UPLOAD_FAILED', error: error.message });
      throw new AppError(
        'Failed to upload completion proof',
        500, true, 'S3_UPLOAD_FAILED'
      );
    }
  }

  /* =====================================================
     GET PRE-SIGNED READ URL
     Default: 2 hours expiry
     Never expose raw S3 URLs
  ===================================================== */

  static async getPresignedUrl(
    key:     string,
    expires: number = SECURITY.S3_READ_URL_EXPIRY_SECS // 7200 = 2 hours
  ): Promise<string> {

    try {
      return await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
        { expiresIn: expires }
      );
    } catch (error: any) {
      logger.error({
        event: 'S3_PRESIGN_FAILED',
        key,
        error: error.message,
      });
      throw new AppError(
        'Could not generate secure access link',
        500, true, 'S3_PRESIGN_FAILED'
      );
    }
  }

  /* =====================================================
     DELETE FILE
  ===================================================== */

  static async deleteFile(key: string): Promise<void> {

    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key:    key,
      }));

      logger.info({ event: 'S3_DELETE_SUCCESS', key });

    } catch (error: any) {
      logger.error({
        event: 'S3_DELETE_FAILED',
        key,
        error: error.message,
      });
      throw new AppError(
        'Failed to delete document from storage',
        500, true, 'S3_DELETE_FAILED'
      );
    }
  }

  /* =====================================================
     VALIDATE FILE (without uploading)
     Use in controllers before calling uploadFile()
  ===================================================== */

  static validateFile(file: Express.Multer.File): void {
    const maxSizeBytes = SYSTEM_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new AppError(
        `File exceeds ${SYSTEM_LIMITS.MAX_FILE_SIZE_MB}MB limit`,
        400, true, 'FILE_TOO_LARGE'
      );
    }

    if (!this.ALLOWED_TYPES[file.mimetype]) {
      throw new AppError(
        'Unsupported file type. Allowed: PDF, JPEG, PNG, WebP',
        400, true, 'FILE_TYPE_NOT_ALLOWED'
      );
    }
  }
}