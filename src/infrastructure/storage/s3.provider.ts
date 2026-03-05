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
 */

export class S3Provider {

  //////////////////////////////////////////////////////
  // ALLOWED FILE TYPES
  //////////////////////////////////////////////////////

  private static readonly ALLOWED_TYPES: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  };

  //////////////////////////////////////////////////////
  // UPLOAD FILE
  //////////////////////////////////////////////////////

  static async uploadFile(
    file: Express.Multer.File,
    folder: string,
    userId?: string
  ): Promise<{ key: string }> {

    const maxSizeBytes =
      SYSTEM_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;

    //////////////////////////////////////////////////////
    // SIZE VALIDATION
    //////////////////////////////////////////////////////

    if (file.size > maxSizeBytes) {

      throw new AppError(
        `File exceeds ${SYSTEM_LIMITS.MAX_FILE_SIZE_MB}MB limit`,
        400,
        true,
        'FILE_TOO_LARGE'
      );
    }

    //////////////////////////////////////////////////////
    // TYPE VALIDATION
    //////////////////////////////////////////////////////

    const extension = this.ALLOWED_TYPES[file.mimetype];

    if (!extension) {

      throw new AppError(
        'Unsupported file type',
        400,
        true,
        'FILE_TYPE_NOT_ALLOWED'
      );
    }

    //////////////////////////////////////////////////////
    // STORAGE KEY
    //////////////////////////////////////////////////////

    const key =
      `${folder}/${userId || 'system'}/${uuidv4()}.${extension}`;

    try {

      const command = new PutObjectCommand({

        Bucket: BUCKET_NAME,

        Key: key,

        Body: file.buffer,

        ContentType: file.mimetype,

        ContentLength: file.size,

        ContentDisposition: 'inline',

        //////////////////////////////////////////////////////
        // ENCRYPTION (IMPORTANT)
        //////////////////////////////////////////////////////

        ServerSideEncryption: 'AES256',

        Metadata: {
          uploadedBy: userId || 'system',
        },
      });

      await s3Client.send(command);

      logger.info({
        event: 'S3_UPLOAD_SUCCESS',
        key,
      });

      return { key };

    } catch (error: any) {

      logger.error({
        event: 'S3_UPLOAD_FAILED',
        key,
        error: error.message,
      });

      throw new AppError(
        'Failed to upload document to storage',
        500,
        true,
        'S3_UPLOAD_FAILED'
      );
    }
  }

  //////////////////////////////////////////////////////
  // GENERATE SECURE URL
  //////////////////////////////////////////////////////

  static async getPresignedUrl(
    key: string,
    expires: number = 600
  ): Promise<string> {

    try {

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      return await getSignedUrl(
        s3Client,
        command,
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
        500,
        true,
        'S3_PRESIGN_FAILED'
      );
    }
  }

  //////////////////////////////////////////////////////
  // DELETE FILE
  //////////////////////////////////////////////////////

  static async deleteFile(key: string): Promise<void> {

    try {

      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);

      logger.info({
        event: 'S3_DELETE_SUCCESS',
        key,
      });

    } catch (error: any) {

      logger.error({
        event: 'S3_DELETE_FAILED',
        key,
        error: error.message,
      });

      throw new AppError(
        'Failed to delete document from storage',
        500,
        true,
        'S3_DELETE_FAILED'
      );
    }
  }
}