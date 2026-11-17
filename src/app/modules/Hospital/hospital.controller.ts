import { Request, Response } from 'express';
import { z } from 'zod';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { HospitalService } from './hospital.service';

const upsertHospitalProfileValidationSchema = z.object({
  body: z.object({
    hospitalName: z
      .string({ required_error: 'Hospital name is required' })
      .min(2)
      .max(120),
    district: z.string({ required_error: 'District is required' }).min(2),
    address: z.string({ required_error: 'Address is required' }).min(5),
    registrationNo: z.string().max(60).optional(),
    contactPerson: z.string().max(80).optional(),
  }),
});

const upsertMyHospitalProfile = catchAsync(
  async (req: Request, res: Response) => {
    const profile = await HospitalService.upsertMyHospitalProfile(
      req.user!.userId,
      req.body,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Hospital profile saved successfully',
      data: profile,
    });
  },
);

const getMyHospitalProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await HospitalService.getMyHospitalProfile(req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Hospital profile retrieved successfully',
    data: profile,
  });
});

export const HospitalController = {
  upsertMyHospitalProfile,
  getMyHospitalProfile,
};

export const HospitalValidation = {
  upsertHospitalProfileValidationSchema,
};
