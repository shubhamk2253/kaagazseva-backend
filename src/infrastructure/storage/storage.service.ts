import { S3Provider } from './s3.provider';
import { AppError } from '../../core/AppError';
import { SYSTEM_LIMITS } from '../../core/constants';
import logger from '../../core/logger';
import { isProduction } from '../../config/env';

/**
 * Allowed secure storage folders
 * Strict isolation prevents path traversal risks
 */
export type StorageFolder =
  | 'kyc'
  | 'applications'
  | 'tickets';

/**
 * KAAGAZSEVA - Storage Business Service
 * Enterprise Secure Document Handling Layer
 */
export class StorageService {
  private static readonly ALLOWED_MIMES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ];

  /* =====================================================
     Upload Document
  ===================================================== */
  static async uploadDocument(
    file: Express.Multer.File,
    folder: StorageFolder,
    userId?: string
  ): Promise<{ key: string }> {

    if (!file) {
      throw new AppError('No file provided', 400);
    }

    // 1️⃣ Validate MIME type
    if (!this.ALLOWED_MIMES.includes(file.mimetype)) {
      throw new AppError(
        'Invalid file type. Only PDF, JPEG, and PNG allowed.',
        400
      );
    }

    // 2️⃣ Validate File Size
    const maxSizeBytes =
      SYSTEM_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new AppError(
        `File exceeds ${SYSTEM_LIMITS.MAX_FILE_SIZE_MB}MB limit`,
        400
      );
    }

    // 3️⃣ Enforce folder isolation
    if (!['kyc', 'applications', 'tickets'].includes(folder)) {
      throw new AppError('Invalid storage folder', 400);
    }

    try {
      logger.info({
        event: 'STORAGE_UPLOAD',
        folder,
        file: file.originalname,
        user: userId ?? 'unknown',
        size: file.size,
      });

      return await S3Provider.uploadFile(
        file,
        folder,
        userId
      );

    } catch (error) {
      logger.error('Storage upload failed', error);
      throw new AppError(
        'Document upload failed. Please try again.',
        500
      );
    }
  }

  /* =====================================================
     Secure Temporary Access
  ===================================================== */
  static async getSecureAccess(
    key: string,
    expiresInSeconds?: number
  ): Promise<string> {

    if (!key) {
      throw new AppError('File key is required', 400);
    }

    // 1️⃣ Prevent malicious key access
    if (!key.includes('/')) {
      throw new AppError('Invalid storage key', 400);
    }

    // 2️⃣ Short expiry in production
    const expiry =
      expiresInSeconds ??
      (isProduction ? 900 : 3600); // 15 mins prod, 1 hr dev

    return await S3Provider.getPresignedUrl(
      key,
      expiry
    );
  }

  /* =====================================================
     Delete Document
  ===================================================== */
  static async deleteDocument(
    key: string
  ): Promise<void> {

    if (!key) {
      throw new AppError(
        'File key required for deletion',
        400
      );
    }

    await S3Provider.deleteFile(key);

    logger.info({
      event: 'STORAGE_DELETE',
      key,
    });
  }
}