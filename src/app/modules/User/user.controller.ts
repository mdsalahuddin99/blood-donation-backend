import { Request, Response } from 'express';
import { z } from 'zod';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserService } from './user.service';

const updateProfileValidationSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    phone: z.string().min(6).max(20).optional(),
  }),
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.getMyProfile(req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Profile retrieved successfully',
    data: user,
  });
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.updateMyProfile(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Profile updated successfully',
    data: user,
  });
});

export const UserController = {
  getMyProfile,
  updateMyProfile,
};

export const UserValidation = {
  updateProfileValidationSchema,
};
