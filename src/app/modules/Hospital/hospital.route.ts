import { Router } from 'express';
import { Role } from '@prisma/client';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { HospitalController, HospitalValidation } from './hospital.controller';

const router = Router();

router.post(
  '/me',
  auth(Role.HOSPITAL),
  validateRequest(HospitalValidation.upsertHospitalProfileValidationSchema),
  HospitalController.upsertMyHospitalProfile,
);

router.get('/me', auth(Role.HOSPITAL), HospitalController.getMyHospitalProfile);

export const HospitalRoutes = router;
