import { BloodGroup, Prisma } from '@prisma/client';
import AppError from '../../errors/AppError';
import prisma from '../../utils/prisma';
import { buildMeta, parsePagination } from '../../utils/pagination';

type TDonorProfilePayload = {
  bloodGroup: BloodGroup;
  district: string;
  area?: string;
  gender?: string;
  dateOfBirth?: string;
  lastDonationDate?: string;
};

const upsertMyDonorProfile = async (
  userId: string,
  payload: TDonorProfilePayload,
) => {
  const data = {
    bloodGroup: payload.bloodGroup,
    district: payload.district,
    area: payload.area,
    gender: payload.gender,
    dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : undefined,
    lastDonationDate: payload.lastDonationDate
      ? new Date(payload.lastDonationDate)
      : undefined,
  };

  const profile = await prisma.donorProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
  });
  return profile;
};

const updateMyAvailability = async (userId: string, isAvailable: boolean) => {
  const profile = await prisma.donorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError(404, 'Donor profile not found. Create it first.');
  }
  return prisma.donorProfile.update({
    where: { userId },
    data: { isAvailable },
  });
};

type TDonorQuery = {
  bloodGroup?: BloodGroup;
  district?: string;
  available?: string;
  search?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
};

const listDonors = async (query: TDonorQuery) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);

  const where: Prisma.DonorProfileWhereInput = {
    deletedAt: null,
    ...(query.bloodGroup ? { bloodGroup: query.bloodGroup } : {}),
    ...(query.district
      ? { district: { equals: query.district, mode: 'insensitive' } }
      : {}),
    ...(query.available !== undefined
      ? { isAvailable: query.available === 'true' }
      : {}),
    ...(query.search
      ? {
          OR: [
            { area: { contains: query.search, mode: 'insensitive' } },
            {
              user: {
                name: { contains: query.search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {}),
  };

  const allowedSortFields = ['createdAt', 'lastDonationDate', 'totalDonations'];
  const orderBy: Prisma.DonorProfileOrderByWithRelationInput = allowedSortFields.includes(
    sortBy,
  )
    ? { [sortBy]: sortOrder }
    : { createdAt: 'desc' };

  const [donors, total] = await Promise.all([
    prisma.donorProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        user: { select: { name: true, phone: true } },
      },
    }),
    prisma.donorProfile.count({ where }),
  ]);

  return { meta: buildMeta(page, limit, total), data: donors };
};

const getDonorById = async (id: string) => {
  const donor = await prisma.donorProfile.findFirst({
    where: { id, deletedAt: null },
    include: { user: { select: { name: true, phone: true } } },
  });
  if (!donor) {
    throw new AppError(404, 'Donor not found');
  }
  return donor;
};

export const DonorService = {
  upsertMyDonorProfile,
  updateMyAvailability,
  listDonors,
  getDonorById,
};
