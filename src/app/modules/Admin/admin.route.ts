import { Request, Response, Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import auth from '../../middlewares/auth';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import validateRequest from '../../middlewares/validateRequest';
import { AdminService } from './admin.service';

const updateUserValidationSchema = z.object({
  body: z.object({
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
  }),
});

const listUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.listUsers(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Users retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
  const user = await AdminService.updateUser(req.user!, req.params.id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User updated successfully',
    data: user,
  });
});

const verifyHospital = catchAsync(async (req: Request, res: Response) => {
  const profile = await AdminService.verifyHospital(req.user!, req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Hospital verified successfully',
    data: profile,
  });
});

const verifyBloodRequest = catchAsync(async (req: Request, res: Response) => {
  const request = await AdminService.verifyBloodRequest(
    req.user!,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Blood request verified and opened successfully',
    data: request,
  });
});

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await AdminService.getDashboardStats();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Dashboard statistics retrieved successfully',
    data: stats,
  });
});

const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.listAuditLogs(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Audit logs retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const router = Router();

router.get('/users', auth(Role.ADMIN), listUsers);
router.patch(
  '/users/:id',
  auth(Role.ADMIN),
  validateRequest(updateUserValidationSchema),
  updateUser,
);
router.patch('/hospitals/:id/verify', auth(Role.ADMIN), verifyHospital);
router.patch(
  '/blood-requests/:id/verify',
  auth(Role.ADMIN),
  verifyBloodRequest,
);
router.get('/dashboard-stats', auth(Role.ADMIN), getDashboardStats);
router.get('/audit-logs', auth(Role.ADMIN), listAuditLogs);

export const AdminRoutes = router;
