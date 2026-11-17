import AppError from '../../errors/AppError';
import prisma from '../../utils/prisma';

type THospitalProfilePayload = {
  hospitalName: string;
  district: string;
  address: string;
  registrationNo?: string;
  contactPerson?: string;
};

const upsertMyHospitalProfile = async (
  userId: string,
  payload: THospitalProfilePayload,
) => {
  const profile = await prisma.hospitalProfile.upsert({
    where: { userId },
    update: payload,
    create: { userId, ...payload },
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
  });
  return profile;
};

const getMyHospitalProfile = async (userId: string) => {
  const profile = await prisma.hospitalProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
  });
  if (!profile) {
    throw new AppError(404, 'Hospital profile not found. Create it first.');
  }
  return profile;
};

export const HospitalService = {
  upsertMyHospitalProfile,
  getMyHospitalProfile,
};
