import { Router } from 'express';
import { PublicController } from './public.controller';

const router = Router();

router.get('/states', PublicController.getStates);
router.get('/services', PublicController.getServicesByState);
router.get('/services/:id/documents', PublicController.getServiceDocuments);

export default router;