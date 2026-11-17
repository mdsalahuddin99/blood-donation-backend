import { Request, Response } from 'express';
import { BloodGroup } from '@prisma/client';
import { z } from 'zod';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { DonorService } from './donor.service';

const upsertDonorProfileValidationSchema = z.object({
  body: z.object({
    bloodGroup: z.nativeEnum(BloodGroup, {
      required_error: 'Blood group is required',
    }),
    district: z.string({ required_error: 'District is required' }).min(2),
    area: z.string().max(80).optional(),
    gender: z.string().max(20).optional(),
    dateOfBirth: z.string().datetime().optional(),
    lastDonationDate: z.string().datetime().optional(),
  }),
});

const updateAvailabilityValidationSchema = z.object({
  body: z.object({
    isAvailable: z.boolean({ required_error: 'isAvailable is required' }),
  }),
});

const upsertMyDonorProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await DonorService.upsertMyDonorProfile(
    req.user!.userId,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Donor profile saved successfully',
    data: profile,
  });
});

const updateMyAvailability = catchAsync(async (req: Request, res: Response) => {
  const profile = await DonorService.updateMyAvailability(
    req.user!.userId,
    req.body.isAvailable,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Availability updated successfully',
    data: profile,
  });
});

const listDonors = catchAsync(async (req: Request, res: Response) => {
  const result = await DonorService.listDonors(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Donors retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getDonorById = catchAsync(async (req: Request, res: Response) => {
  const donor = await DonorService.getDonorById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Donor retrieved successfully',
    data: donor,
  });
});

export const DonorController = {
  upsertMyDonorProfile,
  updateMyAvailability,
  listDonors,
  getDonorById,
};

export const DonorValidation = {
  upsertDonorProfileValidationSchema,
  updateAvailabilityValidationSchema,
};
