import { S3Provider }      from './s3.provider';
import { AppError }        from '../../core/AppError';
import logger              from '../../core/logger';
import { SECURITY }        from '../../core/constants';

/**
 * KAAGAZSEVA - Storage Business Service
 * Secure document management layer.
 * Sits between controllers and S3Provider.
 */

/* =====================================================
   STORAGE FOLDERS — whitelist
===================================================== */

export type StorageFolder =
  | 'kyc'
  | 'applications'
  | 'agents'
  | 'receipts'
  | 'proofs'
  | 'tickets'
  | 'watermarked';

const VALID_PREFIXES: StorageFolder[] = [
  'kyc',
  'applications',
  'agents',
  'receipts',
  'proofs',
  'tickets',
  'watermarked',
];

/* =====================================================
   STORAGE SERVICE
===================================================== */

export class StorageService {

  /* =====================================================
     UPLOAD DOCUMENT
  ===================================================== */

  static async uploadDocument(
    file:           Express.Multer.File,
    folder:         StorageFolder,
    userId?:        string,
    applicationId?: string
  ): Promise<{ key: string; size: number; mimeType: string }> {

    if (!file) {
      throw new AppError('No file provided', 400, true, 'FILE_REQUIRED');
    }

    if (!VALID_PREFIXES.includes(folder)) {
      throw new AppError('Invalid storage folder', 400, true, 'INVALID_FOLDER');
    }

    logger.info({
      event:    'STORAGE_UPLOAD_REQUEST',
      folder,
      filename: file.originalname,
      userId:   userId ?? 'system',
      size:     file.size,
    });

    try {
      const result = await S3Provider.uploadFile(
        file,
        folder,
        userId,
        applicationId
      );

      return result;

    } catch (error: any) {
      // Re-throw AppErrors as-is (FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED etc.)
      if (error instanceof AppError) throw error;

      logger.error({
        event:    'STORAGE_UPLOAD_FAILED',
        folder,
        filename: file.originalname,
        error:    error.message,
      });

      throw new AppError(
        'Document upload failed. Please try again.',
        500, true, 'STORAGE_UPLOAD_FAILED'
      );
    }
  }

  /* =====================================================
     SECURE FILE ACCESS
     Returns pre-signed URL valid for 2 hours
  ===================================================== */

  static async getSecureAccess(
    key:              string,
    expiresInSeconds: number = SECURITY.S3_READ_URL_EXPIRY_SECS
  ): Promise<string> {

    if (!key) {
      throw new AppError('File key is required', 400, true, 'FILE_KEY_REQUIRED');
    }

    // Validate key prefix — prevent arbitrary S3 access
    const prefix = key.split('/')[0];
    if (!VALID_PREFIXES.includes(prefix as StorageFolder)) {
      throw new AppError('Invalid storage key', 400, true, 'INVALID_STORAGE_KEY');
    }

    try {
      const url = await S3Provider.getPresignedUrl(key, expiresInSeconds);

      logger.info({
        event:   'STORAGE_ACCESS_GRANTED',
        key,
        expires: expiresInSeconds,
      });

      return url;

    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error({
        event: 'STORAGE_ACCESS_FAILED',
        key,
        error: error.message,
      });

      throw new AppError(
        'Unable to generate file access link',
        500, true, 'STORAGE_ACCESS_FAILED'
      );
    }
  }

  /* =====================================================
     DELETE DOCUMENT
  ===================================================== */

  static async deleteDocument(key: string): Promise<void> {

    if (!key) {
      throw new AppError('File key required', 400, true, 'FILE_KEY_REQUIRED');
    }

    // Validate key prefix before deleting
    const prefix = key.split('/')[0];
    if (!VALID_PREFIXES.includes(prefix as StorageFolder)) {
      throw new AppError('Invalid storage key', 400, true, 'INVALID_STORAGE_KEY');
    }

    try {
      await S3Provider.deleteFile(key);

      logger.info({ event: 'STORAGE_DELETE_SUCCESS', key });

    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error({
        event: 'STORAGE_DELETE_FAILED',
        key,
        error: error.message,
      });

      throw new AppError(
        'Document deletion failed',
        500, true, 'STORAGE_DELETE_FAILED'
      );
    }
  }

  /* =====================================================
     UPLOAD COMPLETION PROOF
     Specific method for agent job completion
  ===================================================== */

  static async uploadCompletionProof(
    file:          Express.Multer.File,
    applicationId: string,
    agentId:       string
  ): Promise<{ key: string }> {

    if (!file) {
      throw new AppError('No proof file provided', 400, true, 'FILE_REQUIRED');
    }

    try {
      return await S3Provider.uploadCompletionProof(
        file,
        applicationId,
        agentId
      );
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error({
        event:         'STORAGE_PROOF_UPLOAD_FAILED',
        applicationId,
        error:         error.message,
      });

      throw new AppError(
        'Failed to upload completion proof',
        500, true, 'STORAGE_UPLOAD_FAILED'
      );
    }
  }

  /* =====================================================
     VALIDATE FILE ONLY (no upload)
     Use in controllers for early validation
  ===================================================== */

  static validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new AppError('No file provided', 400, true, 'FILE_REQUIRED');
    }
    S3Provider.validateFile(file);
  }
}