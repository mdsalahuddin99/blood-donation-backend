import { Prisma, RequestStatus, Role } from '@prisma/client';
import AppError from '../../errors/AppError';
import { TAuthUser } from '../../interface';
import prisma from '../../utils/prisma';
import { buildMeta, parsePagination } from '../../utils/pagination';
import { createAuditLog } from '../../utils/audit';
import { createNotification } from '../../utils/notification';

type TUserQuery = {
  role?: Role;
  search?: string;
  page?: string;
  limit?: string;
};

const listUsers = async (query: TUserQuery) => {
  const { page, limit, skip } = parsePagination(query);
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.role ? { role: query.role } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { meta: buildMeta(page, limit, total), data: users };
};

const updateUser = async (
  actor: TAuthUser,
  userId: string,
  payload: { role?: Role; isActive?: boolean },
) => {
  if (actor.userId === userId) {
    throw new AppError(400, 'You cannot change your own role or status');
  }
  const target = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!target) {
    throw new AppError(404, 'User not found');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.role !== undefined ? { role: payload.role } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  await createAuditLog(actor.userId, 'UPDATE_USER', 'User', userId, payload);
  return updated;
};

const verifyHospital = async (actor: TAuthUser, profileId: string) => {
  const profile = await prisma.hospitalProfile.findFirst({
    where: { id: profileId, deletedAt: null },
  });
  if (!profile) {
    throw new AppError(404, 'Hospital profile not found');
  }
  if (profile.isVerified) {
    throw new AppError(400, 'Hospital is already verified');
  }

  const updated = await prisma.hospitalProfile.update({
    where: { id: profileId },
    data: { isVerified: true },
  });

  await createNotification({
    userId: profile.userId,
    type: 'HOSPITAL_VERIFIED',
    title: 'Your hospital is verified',
    message: `${profile.hospitalName} is now a verified hospital on the platform.`,
  });
  await createAuditLog(
    actor.userId,
    'VERIFY',
    'HospitalProfile',
    profileId,
    { hospitalName: profile.hospitalName },
  );
  return updated;
};

const verifyBloodRequest = async (actor: TAuthUser, requestId: string) => {
  const request = await prisma.bloodRequest.findFirst({
    where: { id: requestId, deletedAt: null },
    include: { hospital: true },
  });
  if (!request) {
    throw new AppError(404, 'Blood request not found');
  }
  if (request.status !== RequestStatus.PENDING) {
    throw new AppError(
      400,
      `Only PENDING requests can be verified (current: ${request.status})`,
    );
  }

  const updated = await prisma.bloodRequest.update({
    where: { id: requestId },
    data: { status: RequestStatus.OPEN },
  });

  await createNotification({
    userId: request.hospital.userId,
    type: 'REQUEST_VERIFIED',
    title: 'Your blood request is now open',
    message: `The request for ${request.patientName} (${request.bloodGroup}) is verified and visible to donors.`,
    relatedRequestId: request.id,
  });
  await createAuditLog(actor.userId, 'VERIFY', 'BloodRequest', requestId, {
    from: 'PENDING',
    to: 'OPEN',
  });
  return updated;
};

const getDashboardStats = async () => {
  const [
    totalUsers,
    donors,
    hospitals,
    verifiedHospitals,
    requestsByStatus,
    totalDonations,
    unitsFulfilledAgg,
    paymentsAgg,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: Role.DONOR, deletedAt: null } }),
    prisma.user.count({ where: { role: Role.HOSPITAL, deletedAt: null } }),
    prisma.hospitalProfile.count({ where: { isVerified: true } }),
    prisma.bloodRequest.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    }),
    prisma.donation.count(),
    prisma.bloodRequest.aggregate({
      where: { deletedAt: null },
      _sum: { unitsFulfilled: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    users: { total: totalUsers, donors, hospitals },
    hospitalsVerified: verifiedHospitals,
    bloodRequests: Object.fromEntries(
      requestsByStatus.map((row) => [row.status, row._count]),
    ),
    donations: {
      totalRecords: totalDonations,
      unitsFulfilled: unitsFulfilledAgg._sum.unitsFulfilled ?? 0,
    },
    payments: {
      paidCount: paymentsAgg._count,
      paidAmount: paymentsAgg._sum.amount?.toString() ?? '0',
    },
  };
};

const listAuditLogs = async (query: { page?: string; limit?: string }) => {
  const { page, limit, skip } = parsePagination(query);
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { name: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);
  return { meta: buildMeta(page, limit, total), data: logs };
};

export const AdminService = {
  listUsers,
  updateUser,
  verifyHospital,
  verifyBloodRequest,
  getDashboardStats,
  listAuditLogs,
};
