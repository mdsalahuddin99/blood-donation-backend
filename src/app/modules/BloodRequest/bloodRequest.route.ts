import { Router } from 'express';
import { Role } from '@prisma/client';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import {
  BloodRequestController,
  BloodRequestValidation,
} from './bloodRequest.controller';

const router = Router();

router.post(
  '/',
  auth(Role.HOSPITAL),
  validateRequest(BloodRequestValidation.createBloodRequestValidationSchema),
  BloodRequestController.createBloodRequest,
);

router.get('/', auth(), BloodRequestController.listBloodRequests);

router.get(
  '/my-requests',
  auth(Role.HOSPITAL),
  BloodRequestController.getMyRequests,
);

router.get('/:id', auth(), BloodRequestController.getBloodRequestById);

router.patch(
  '/:id',
  auth(Role.HOSPITAL, Role.ADMIN),
  validateRequest(BloodRequestValidation.updateBloodRequestValidationSchema),
  BloodRequestController.updateBloodRequest,
);

router.delete(
  '/:id',
  auth(Role.HOSPITAL, Role.ADMIN),
  BloodRequestController.deleteBloodRequest,
);

router.get(
  '/:id/matching-donors',
  auth(Role.HOSPITAL, Role.ADMIN),
  BloodRequestController.getMatchingDonors,
);

router.post(
  '/:id/respond',
  auth(Role.DONOR),
  BloodRequestController.respondToRequest,
);

router.patch(
  '/:id/responses/:responseId/confirm-donation',
  auth(Role.HOSPITAL, Role.ADMIN),
  BloodRequestController.confirmDonation,
);

export const BloodRequestRoutes = router;
