import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '../../config/s3';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';
import { v4 as uuidv4 } from 'uuid';
import { SYSTEM_LIMITS } from '../../core/constants';

/**
 * KAAGAZSEVA - Secure S3 Storage Provider
 * GovTech-grade secure storage layer
 */
export class S3Provider {
  private static readonly ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
  ];

  /* =====================================================
     Upload File
  ===================================================== */
  static async uploadFile(
    file: Express.Multer.File,
    folder: string,
    userId?: string
  ): Promise<{ key: string }> {

    const maxSizeBytes =
      SYSTEM_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;

    // 1️⃣ Validate file size
    if (file.size > maxSizeBytes) {
      throw new AppError(
        `File exceeds ${SYSTEM_LIMITS.MAX_FILE_SIZE_MB}MB limit`,
        400
      );
    }

    // 2️⃣ Validate file type
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new AppError('Unsupported file type', 400);
    }

    // 3️⃣ Safe extension extraction
    const extension = file.mimetype === 'application/pdf'
      ? 'pdf'
      : file.mimetype === 'image/jpeg'
      ? 'jpg'
      : 'png';

    // 4️⃣ Structured key for scalability
    const key = `${folder}/${userId || 'system'}/${uuidv4()}.${extension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,

        // Always private
        ACL: 'private',

        // Important for browser downloads
        ContentDisposition: 'inline',

        Metadata: {
          uploadedBy: userId || 'system',
        },
      });

      await s3Client.send(command);

      logger.info(`S3 Upload Success → ${key}`);

      return { key };
    } catch (error: any) {
      logger.error(`S3 Upload Error → ${error.message}`);
      throw new AppError(
        'Failed to upload document to storage',
        500
      );
    }
  }

  /* =====================================================
     Generate Secure URL
  ===================================================== */
  static async getPresignedUrl(
    key: string,
    expires: number = 600 // 10 minutes default
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      return await getSignedUrl(s3Client, command, {
        expiresIn: expires,
      });
    } catch (error: any) {
      logger.error(`S3 Presign Error → ${error.message}`);
      throw new AppError(
        'Could not generate secure access link',
        500
      );
    }
  }

  /* =====================================================
     Delete File
  ===================================================== */
  static async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);

      logger.info(`S3 Delete Success → ${key}`);
    } catch (error: any) {
      logger.error(`S3 Delete Error → ${error.message}`);
      throw new AppError(
        'Failed to delete document from storage',
        500
      );
    }
  }
}