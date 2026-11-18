import {
  BloodGroup,
  Prisma,
  RequestStatus,
  ResponseStatus,
  Role,
  Urgency,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import { TAuthUser } from '../../interface';
import prisma from '../../utils/prisma';
import { buildMeta, parsePagination } from '../../utils/pagination';
import {
  canDonateTo,
  compatibleDonorGroups,
  isEligibleToDonate,
} from '../../utils/bloodCompatibility';
import { createAuditLog } from '../../utils/audit';
import { createNotification } from '../../utils/notification';

type TCreateRequestPayload = {
  patientName: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  district: string;
  hospitalAddress: string;
  urgency?: Urgency;
  neededBy: string;
  reason?: string;
  contactPhone: string;
};

const getHospitalProfileOrThrow = async (userId: string) => {
  const profile = await prisma.hospitalProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    throw new AppError(
      400,
      'Create your hospital profile first (POST /hospitals/me)',
    );
  }
  return profile;
};

const createBloodRequest = async (
  authUser: TAuthUser,
  payload: TCreateRequestPayload,
) => {
  const hospital = await getHospitalProfileOrThrow(authUser.userId);

  const request = await prisma.bloodRequest.create({
    data: {
      hospitalId: hospital.id,
      patientName: payload.patientName,
      bloodGroup: payload.bloodGroup,
      unitsNeeded: payload.unitsNeeded,
      district: payload.district,
      hospitalAddress: payload.hospitalAddress,
      urgency: payload.urgency ?? Urgency.NORMAL,
      neededBy: new Date(payload.neededBy),
      reason: payload.reason,
      contactPhone: payload.contactPhone,
    },
    include: { hospital: { select: { hospitalName: true, district: true } } },
  });

  await createAuditLog(authUser.userId, 'CREATE', 'BloodRequest', request.id, {
    bloodGroup: request.bloodGroup,
    unitsNeeded: request.unitsNeeded,
  });

  return request;
};

type TListQuery = {
  bloodGroup?: BloodGroup;
  district?: string;
  urgency?: Urgency;
  status?: RequestStatus;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
};

const listBloodRequests = async (authUser: TAuthUser, query: TListQuery) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);

  const where: Prisma.BloodRequestWhereInput = {
    deletedAt: null,
    ...(query.bloodGroup ? { bloodGroup: query.bloodGroup } : {}),
    ...(query.district
      ? { district: { equals: query.district, mode: 'insensitive' } }
      : {}),
    ...(query.urgency ? { urgency: query.urgency } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  // Donors only ever see OPEN requests.
  if (authUser.role === Role.DONOR) {
    where.status = RequestStatus.OPEN;
  }

  const allowedSortFields = ['createdAt', 'neededBy', 'urgency'];
  const orderBy: Prisma.BloodRequestOrderByWithRelationInput =
    allowedSortFields.includes(sortBy)
      ? { [sortBy]: sortOrder }
      : { createdAt: 'desc' };

  const [requests, total] = await Promise.all([
    prisma.bloodRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        hospital: { select: { hospitalName: true, district: true } },
        _count: { select: { responses: true } },
      },
    }),
    prisma.bloodRequest.count({ where }),
  ]);

  return { meta: buildMeta(page, limit, total), data: requests };
};

const getBloodRequestById = async (id: string) => {
  const request = await prisma.bloodRequest.findFirst({
    where: { id, deletedAt: null },
    include: {
      hospital: {
        select: { hospitalName: true, district: true, address: true },
      },
      responses: {
        include: {
          donor: {
            include: { user: { select: { name: true, phone: true } } },
          },
        },
      },
    },
  });
  if (!request) {
    throw new AppError(404, 'Blood request not found');
  }
  return request;
};

const getMyRequests = async (authUser: TAuthUser, query: TListQuery) => {
  const hospital = await getHospitalProfileOrThrow(authUser.userId);
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.BloodRequestWhereInput = {
    hospitalId: hospital.id,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
  };

  const [requests, total] = await Promise.all([
    prisma.bloodRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { responses: true } } },
    }),
    prisma.bloodRequest.count({ where }),
  ]);

  return { meta: buildMeta(page, limit, total), data: requests };
};

type TUpdatePayload = Partial<{
  patientName: string;
  unitsNeeded: number;
  district: string;
  hospitalAddress: string;
  urgency: Urgency;
  neededBy: string;
  reason: string;
  contactPhone: string;
}>;

const assertOwnRequest = async (authUser: TAuthUser, requestId: string) => {
  const request = await prisma.bloodRequest.findFirst({
    where: { id: requestId, deletedAt: null },
    include: { hospital: true },
  });
  if (!request) {
    throw new AppError(404, 'Blood request not found');
  }
  if (
    authUser.role !== Role.ADMIN &&
    request.hospital.userId !== authUser.userId
  ) {
    throw new AppError(403, 'This is not your blood request');
  }
  return request;
};

const updateBloodRequest = async (
  authUser: TAuthUser,
  id: string,
  payload: TUpdatePayload,
) => {
  const request = await assertOwnRequest(authUser, id);

  if (
    request.status !== RequestStatus.PENDING &&
    request.status !== RequestStatus.OPEN
  ) {
    throw new AppError(400, 'Only PENDING or OPEN requests can be updated');
  }
  if (
    payload.unitsNeeded !== undefined &&
    payload.unitsNeeded < request.unitsFulfilled
  ) {
    throw new AppError(
      400,
      'unitsNeeded cannot be lower than units already fulfilled',
    );
  }

  const updated = await prisma.bloodRequest.update({
    where: { id },
    data: {
      ...payload,
      neededBy: payload.neededBy ? new Date(payload.neededBy) : undefined,
    },
  });

  await createAuditLog(authUser.userId, 'UPDATE', 'BloodRequest', id, payload);
  return updated;
};

const deleteBloodRequest = async (authUser: TAuthUser, id: string) => {
  const request = await assertOwnRequest(authUser, id);
  if (request.status === RequestStatus.COMPLETED) {
    throw new AppError(400, 'A completed request cannot be deleted');
  }

  const deleted = await prisma.bloodRequest.update({
    where: { id },
    data: { deletedAt: new Date(), status: RequestStatus.CANCELLED },
  });

  await createAuditLog(authUser.userId, 'DELETE', 'BloodRequest', id, {
    soft: true,
  });
  return deleted;
};

const getMatchingDonors = async (authUser: TAuthUser, requestId: string) => {
  const request = await assertOwnRequest(authUser, requestId);

  const donorGroups = compatibleDonorGroups(request.bloodGroup);
  const candidates = await prisma.donorProfile.findMany({
    where: {
      bloodGroup: { in: donorGroups },
      isAvailable: true,
      deletedAt: null,
    },
    include: { user: { select: { name: true, phone: true } } },
  });

  const now = new Date();
  const eligible = candidates.filter((donor) =>
    isEligibleToDonate(donor.lastDonationDate, now),
  );

  // Same district first, then the longest-rested donors first.
  eligible.sort((a, b) => {
    const aLocal = a.district.toLowerCase() === request.district.toLowerCase();
    const bLocal = b.district.toLowerCase() === request.district.toLowerCase();
    if (aLocal !== bLocal) return aLocal ? -1 : 1;
    const aTime = a.lastDonationDate?.getTime() ?? 0;
    const bTime = b.lastDonationDate?.getTime() ?? 0;
    return aTime - bTime;
  });

  return {
    requestId: request.id,
    recipientBloodGroup: request.bloodGroup,
    district: request.district,
    totalMatched: eligible.length,
    donors: eligible,
  };
};

const respondToRequest = async (authUser: TAuthUser, requestId: string) => {
  const donor = await prisma.donorProfile.findUnique({
    where: { userId: authUser.userId },
  });
  if (!donor) {
    throw new AppError(
      400,
      'Create your donor profile first (POST /donors/me)',
    );
  }

  const request = await prisma.bloodRequest.findFirst({
    where: { id: requestId, deletedAt: null },
    include: { hospital: true },
  });
  if (!request) {
    throw new AppError(404, 'Blood request not found');
  }
  if (request.status !== RequestStatus.OPEN) {
    throw new AppError(400, 'This request is not open for responses');
  }
  if (!donor.isAvailable) {
    throw new AppError(400, 'Your availability is turned off');
  }
  if (!canDonateTo(donor.bloodGroup, request.bloodGroup)) {
    throw new AppError(
      400,
      `Blood group ${donor.bloodGroup} is not compatible with ${request.bloodGroup}`,
    );
  }
  if (!isEligibleToDonate(donor.lastDonationDate)) {
    throw new AppError(
      400,
      'You are not eligible yet — 90 days must pass after your last donation',
    );
  }

  const existing = await prisma.requestResponse.findUnique({
    where: {
      requestId_donorId: { requestId, donorId: donor.id },
    },
  });
  if (existing) {
    throw new AppError(409, 'You have already responded to this request');
  }

  const response = await prisma.requestResponse.create({
    data: { requestId, donorId: donor.id, status: ResponseStatus.INTERESTED },
  });

  await createNotification({
    userId: request.hospital.userId,
    type: 'DONOR_RESPONDED',
    title: 'A donor responded to your blood request',
    message: `A ${donor.bloodGroup} donor from ${donor.district} is interested in your request for ${request.patientName}.`,
    relatedRequestId: request.id,
  });

  return response;
};

const confirmDonation = async (
  authUser: TAuthUser,
  requestId: string,
  responseId: string,
) => {
  const request = await assertOwnRequest(authUser, requestId);

  const response = await prisma.requestResponse.findFirst({
    where: { id: responseId, requestId },
    include: { donor: true },
  });
  if (!response) {
    throw new AppError(404, 'Response not found for this request');
  }
  if (response.status === ResponseStatus.DONATED) {
    throw new AppError(400, 'This donation is already confirmed');
  }
  if (response.status === ResponseStatus.CANCELLED) {
    throw new AppError(400, 'This response was cancelled');
  }

  // Transaction: units counter, donation record, donor history and the
  // request status must move together — or not at all.
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.bloodRequest.findUnique({
      where: { id: requestId },
    });
    if (!fresh) throw new AppError(404, 'Blood request not found');
    if (fresh.unitsFulfilled >= fresh.unitsNeeded) {
      throw new AppError(400, 'All required units are already fulfilled');
    }

    const newFulfilled = fresh.unitsFulfilled + 1;
    const isComplete = newFulfilled >= fresh.unitsNeeded;

    const updatedRequest = await tx.bloodRequest.update({
      where: { id: requestId },
      data: {
        unitsFulfilled: newFulfilled,
        status: isComplete ? RequestStatus.COMPLETED : fresh.status,
      },
    });

    const updatedResponse = await tx.requestResponse.update({
      where: { id: responseId },
      data: { status: ResponseStatus.DONATED, donatedAt: new Date() },
    });

    const donation = await tx.donation.create({
      data: {
        donorId: response.donorId,
        requestId,
        units: 1,
        location: fresh.hospitalAddress,
      },
    });

    await tx.donorProfile.update({
      where: { id: response.donorId },
      data: {
        lastDonationDate: new Date(),
        totalDonations: { increment: 1 },
      },
    });

    return { updatedRequest, updatedResponse, donation };
  });

  await createNotification({
    userId: response.donor.userId,
    type: 'DONATION_CONFIRMED',
    title: 'Your donation was confirmed',
    message: `Thank you! Your donation for ${request.patientName} at ${request.hospital.hospitalName} is confirmed.`,
    relatedRequestId: request.id,
  });
  await createAuditLog(
    authUser.userId,
    'CONFIRM_DONATION',
    'BloodRequest',
    requestId,
    { responseId, unitsFulfilled: result.updatedRequest.unitsFulfilled },
  );

  return result;
};

export const BloodRequestService = {
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
