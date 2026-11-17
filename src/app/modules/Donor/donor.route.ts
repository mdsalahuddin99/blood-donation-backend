import { Router } from 'express';
import { Role } from '@prisma/client';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { DonorController, DonorValidation } from './donor.controller';

const router = Router();

router.post(
  '/me',
  auth(Role.DONOR),
  validateRequest(DonorValidation.upsertDonorProfileValidationSchema),
  DonorController.upsertMyDonorProfile,
);

router.patch(
  '/me/availability',
  auth(Role.DONOR),
  validateRequest(DonorValidation.updateAvailabilityValidationSchema),
  DonorController.updateMyAvailability,
);

router.get('/', auth(), DonorController.listDonors);

router.get('/:id', auth(), DonorController.getDonorById);

export const DonorRoutes = router;
