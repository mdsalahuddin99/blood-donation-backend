import AppError from '../../errors/AppError';
import prisma from '../../utils/prisma';

const getMyProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      donorProfile: true,
      hospitalProfile: true,
    },
  });
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  return user;
};

const updateMyProfile = async (
  userId: string,
  payload: { name?: string; phone?: string },
) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      updatedAt: true,
    },
  });
  return user;
};

export const UserService = {
  getMyProfile,
  updateMyProfile,
};
