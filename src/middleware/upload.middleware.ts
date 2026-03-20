import multer               from 'multer';
import { Request }          from 'express';
import { SYSTEM_LIMITS }    from '../core/constants';
import { AppError }         from '../core/AppError';

/**
 * KAAGAZSEVA - Upload Middleware
 * Memory storage for direct S3 streaming.
 * No temp files — ephemeral filesystem safe (Render).
 */

/* =====================================================
   STORAGE — memory only, no disk writes
===================================================== */

const storage = multer.memoryStorage();

/* =====================================================
   FILE FILTER — whitelist from constants
===================================================== */

function fileFilter(
  _req: Request,
  file:  Express.Multer.File,
  cb:    multer.FileFilterCallback
) {
  if (!SYSTEM_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new AppError(
      'Invalid file type. Only PDF, JPEG, PNG and WebP allowed.',
      400, true, 'FILE_TYPE_NOT_ALLOWED'
    ));
  }
  cb(null, true);
}

/* =====================================================
   BASE MULTER INSTANCE
===================================================== */

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: SYSTEM_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024,
    files:    SYSTEM_LIMITS.MAX_FILES_PER_APPLICATION,
  },
});

/* =====================================================
   NAMED EXPORTS
   Use the right one per route
===================================================== */

// Single file upload (KYC docs, completion proof, receipts)
export const uploadSingle = upload.single('document');

// Multiple files (application document batch)
export const uploadMultiple = upload.array(
  'documents',
  SYSTEM_LIMITS.MAX_FILES_PER_APPLICATION
);

// Specific named fields (agent KYC onboarding)
export const uploadKycFields = upload.fields([
  { name: 'aadhaar', maxCount: 1 },
  { name: 'pan',     maxCount: 1 },
  { name: 'photo',   maxCount: 1 },
]);

// Completion proof (agent marks service done)
export const uploadProof = upload.single('proof');

// Government acknowledgment receipt
export const uploadReceipt = upload.single('receipt');

export default upload;