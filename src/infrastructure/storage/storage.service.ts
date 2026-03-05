import { S3Provider } from './s3.provider';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';
import { isProduction } from '../../config/env';

/**
 * Allowed secure storage folders
 */
export type StorageFolder =
  | 'kyc'
  | 'applications'
  | 'tickets';

/**
 * Valid storage prefixes
 */
const VALID_PREFIXES: StorageFolder[] = [
  'kyc',
  'applications',
  'tickets',
];

/**
 * KAAGAZSEVA - Storage Business Service
 * Secure document management layer.
 */
export class StorageService {

  //////////////////////////////////////////////////////
  // UPLOAD DOCUMENT
  //////////////////////////////////////////////////////

  static async uploadDocument(
    file: Express.Multer.File,
    folder: StorageFolder,
    userId?: string
  ): Promise<{ key: string }> {

    if (!file) {
      throw new AppError(
        'No file provided',
        400,
        true,
        'FILE_REQUIRED'
      );
    }

    //////////////////////////////////////////////////////
    // VALIDATE FOLDER
    //////////////////////////////////////////////////////

    if (!VALID_PREFIXES.includes(folder)) {
      throw new AppError(
        'Invalid storage folder',
        400,
        true,
        'INVALID_FOLDER'
      );
    }

    try {

      logger.info({
        event: 'STORAGE_UPLOAD_REQUEST',
        folder,
        filename: file.originalname,
        userId: userId ?? 'system',
        size: file.size,
      });

      const result = await S3Provider.uploadFile(
        file,
        folder,
        userId
      );

      return result;

    } catch (error: any) {

      logger.error({
        event: 'STORAGE_UPLOAD_FAILED',
        folder,
        filename: file.originalname,
        error: error.message,
      });

      throw new AppError(
        'Document upload failed. Please try again.',
        500,
        true,
        'STORAGE_UPLOAD_FAILED'
      );
    }
  }

  //////////////////////////////////////////////////////
  // SECURE FILE ACCESS
  //////////////////////////////////////////////////////

  static async getSecureAccess(
    key: string,
    expiresInSeconds?: number
  ): Promise<string> {

    if (!key) {
      throw new AppError(
        'File key is required',
        400,
        true,
        'FILE_KEY_REQUIRED'
      );
    }

    //////////////////////////////////////////////////////
    // VALIDATE STORAGE PREFIX
    //////////////////////////////////////////////////////

    const prefix = key.split('/')[0];

    if (!VALID_PREFIXES.includes(prefix as StorageFolder)) {

      throw new AppError(
        'Invalid storage key',
        400,
        true,
        'INVALID_STORAGE_KEY'
      );
    }

    //////////////////////////////////////////////////////
    // EXPIRY POLICY
    //////////////////////////////////////////////////////

    const expiry =
      expiresInSeconds ??
      (isProduction ? 900 : 3600);

    try {

      return await S3Provider.getPresignedUrl(
        key,
        expiry
      );

    } catch (error: any) {

      logger.error({
        event: 'STORAGE_ACCESS_FAILED',
        key,
        error: error.message,
      });

      throw new AppError(
        'Unable to generate file access link',
        500,
        true,
        'STORAGE_ACCESS_FAILED'
      );
    }
  }

  //////////////////////////////////////////////////////
  // DELETE DOCUMENT
  //////////////////////////////////////////////////////

  static async deleteDocument(
    key: string
  ): Promise<void> {

    if (!key) {

      throw new AppError(
        'File key required for deletion',
        400,
        true,
        'FILE_KEY_REQUIRED'
      );
    }

    try {

      await S3Provider.deleteFile(key);

      logger.info({
        event: 'STORAGE_DELETE_SUCCESS',
        key,
      });

    } catch (error: any) {

      logger.error({
        event: 'STORAGE_DELETE_FAILED',
        key,
        error: error.message,
      });

      throw new AppError(
        'Document deletion failed',
        500,
        true,
        'STORAGE_DELETE_FAILED'
      );
    }
  }
}