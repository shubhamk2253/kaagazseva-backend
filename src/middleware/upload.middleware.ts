import multer from 'multer';
import { Request } from 'express';
import { SYSTEM_LIMITS } from '../core/constants';
import { AppError } from '../core/AppError';

/**
 * KAAGAZSEVA - Upload Middleware
 * Memory storage for direct S3 streaming.
 */

const storage = multer.memoryStorage();

/**
 * Allowed file types
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

/**
 * File filter
 */
function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {

    return cb(
      new AppError(
        'Invalid file type. Only PDF, JPEG and PNG allowed.',
        400
      )
    );

  }

  cb(null, true);
}

export const upload = multer({

  storage,

  fileFilter,

  limits: {

    fileSize: SYSTEM_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024,

    files: SYSTEM_LIMITS.MAX_FILES_PER_APPLICATION,

  },

});