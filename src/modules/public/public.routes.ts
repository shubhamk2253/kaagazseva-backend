import { Router } from 'express';
import { PublicController } from './public.controller';

/**
 * KAAGAZSEVA - Public Service Routes
 * No authentication required
 */

const router = Router();

///////////////////////////////////////////////////////
// STEP 1 - Detect State via Pincode
///////////////////////////////////////////////////////

router.post('/pincode', PublicController.detectStateFromPincode);

///////////////////////////////////////////////////////
// STEP 2 - Load Services for State
///////////////////////////////////////////////////////

router.get('/services', PublicController.getServicesByState);

///////////////////////////////////////////////////////
// STEP 3 - Get Required Documents
///////////////////////////////////////////////////////

router.get('/services/:id/documents', PublicController.getServiceDocuments);

export default router;