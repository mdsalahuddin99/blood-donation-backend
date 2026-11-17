import { Router } from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';

const router = Router();

router.post(
  '/register',
  validateRequest(AuthValidation.registerValidationSchema),
  AuthController.register,
);

router.post(
  '/login',
  validateRequest(AuthValidation.loginValidationSchema),
  AuthController.login,
);

router.post('/refresh-token', AuthController.refreshToken);

router.post('/logout', AuthController.logout);

// Google social login (GCP OAuth) is added once the OAuth client
// credentials are configured — see GOOGLE_CLIENT_ID in .env.example.

export const AuthRoutes = router;
