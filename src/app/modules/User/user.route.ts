import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { UserController, UserValidation } from './user.controller';

const router = Router();

router.get('/me', auth(), UserController.getMyProfile);

router.patch(
  '/me',
  auth(),
  validateRequest(UserValidation.updateProfileValidationSchema),
  UserController.updateMyProfile,
);

export const UserRoutes = router;
