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

// Google social login (GCP OAuth) — active once GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL are set in .env.
router.get('/google', AuthController.googleLogin);
router.get('/google/callback', AuthController.googleCallback);

export const AuthRoutes = router;
