import multer from 'multer';
import { SYSTEM_LIMITS } from '../core/constants';

/**
 * KAAGAZSEVA - Upload Middleware
 * Uses memory storage for direct S3 streaming.
 */

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: SYSTEM_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});