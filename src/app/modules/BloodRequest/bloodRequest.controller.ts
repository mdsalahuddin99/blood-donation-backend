import { Request, Response } from 'express';
import { BloodGroup, RequestStatus, Urgency } from '@prisma/client';
import { z } from 'zod';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { BloodRequestService } from './bloodRequest.service';

const createBloodRequestValidationSchema = z.object({
  body: z.object({
    patientName: z.string({ required_error: 'Patient name is required' }).min(2),
    bloodGroup: z.nativeEnum(BloodGroup, {
      required_error: 'Blood group is required',
    }),
    unitsNeeded: z
      .number({ required_error: 'Units needed is required' })
      .int()
      .min(1)
      .max(20),
    district: z.string({ required_error: 'District is required' }).min(2),
    hospitalAddress: z
      .string({ required_error: 'Hospital address is required' })
      .min(5),
    urgency: z.nativeEnum(Urgency).optional(),
    neededBy: z.string({ required_error: 'Needed-by date is required' }).datetime(),
    reason: z.string().max(500).optional(),
    contactPhone: z
      .string({ required_error: 'Contact phone is required' })
      .min(6)
      .max(20),
  }),
});

const updateBloodRequestValidationSchema = z.object({
  body: z.object({
    patientName: z.string().min(2).optional(),
    unitsNeeded: z.number().int().min(1).max(20).optional(),
    district: z.string().min(2).optional(),
    hospitalAddress: z.string().min(5).optional(),
    urgency: z.nativeEnum(Urgency).optional(),
    neededBy: z.string().datetime().optional(),
    reason: z.string().max(500).optional(),
    contactPhone: z.string().min(6).max(20).optional(),
  }),
});

const createBloodRequest = catchAsync(async (req: Request, res: Response) => {
  const request = await BloodRequestService.createBloodRequest(
    req.user!,
    req.body,
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Blood request created successfully. It is PENDING admin verification.',
    data: request,
  });
});

const listBloodRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await BloodRequestService.listBloodRequests(
    req.user!,
    req.query,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Blood requests retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getBloodRequestById = catchAsync(async (req: Request, res: Response) => {
  const request = await BloodRequestService.getBloodRequestById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Blood request retrieved successfully',
    data: request,
  });
});

const getMyRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await BloodRequestService.getMyRequests(req.user!, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Your blood requests retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const updateBloodRequest = catchAsync(async (req: Request, res: Response) => {
  const request = await BloodRequestService.updateBloodRequest(
    req.user!,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Blood request updated successfully',
    data: request,
  });
});

const deleteBloodRequest = catchAsync(async (req: Request, res: Response) => {
  const request = await BloodRequestService.deleteBloodRequest(
    req.user!,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Blood request cancelled and removed successfully',
    data: request,
  });
});

const getMatchingDonors = catchAsync(async (req: Request, res: Response) => {
  const result = await BloodRequestService.getMatchingDonors(
    req.user!,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Matching donors retrieved successfully',
    data: result,
  });
});

const respondToRequest = catchAsync(async (req: Request, res: Response) => {
  const response = await BloodRequestService.respondToRequest(
    req.user!,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Response recorded. The hospital has been notified.',
    data: response,
  });
});

const confirmDonation = catchAsync(async (req: Request, res: Response) => {
  const result = await BloodRequestService.confirmDonation(
    req.user!,
    req.params.id,
    req.params.responseId,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Donation confirmed successfully',
    data: result,
  });
});

export const BloodRequestController = {
  createBloodRequest,
  listBloodRequests,
  getBloodRequestById,
  getMyRequests,
  updateBloodRequest,
  deleteBloodRequest,
  getMatchingDonors,
  respondToRequest,
  confirmDonation,
};

export const BloodRequestValidation = {
  createBloodRequestValidationSchema,
  updateBloodRequestValidationSchema,
};

// Referenced for route-level query typing; keeps enum imports in one place.
export const BloodRequestEnums = { BloodGroup, Urgency, RequestStatus };
