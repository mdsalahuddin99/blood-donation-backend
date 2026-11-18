import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import AppError from '../../errors/AppError';
import auth from '../../middlewares/auth';
import catchAsync from '../../utils/catchAsync';
import prisma from '../../utils/prisma';
import sendResponse from '../../utils/sendResponse';
import { buildMeta, parsePagination } from '../../utils/pagination';
import { Router } from 'express';

const getMyDonationHistory = catchAsync(async (req: Request, res: Response) => {
  const donor = await prisma.donorProfile.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!donor) {
    throw new AppError(404, 'Donor profile not found');
  }

  const { page, limit, skip } = parsePagination(req.query);
  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where: { donorId: donor.id },
      skip,
      take: limit,
      orderBy: { donatedAt: 'desc' },
      include: {
        request: {
          select: { patientName: true, bloodGroup: true, district: true },
        },
      },
    }),
    prisma.donation.count({ where: { donorId: donor.id } }),
  ]);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Donation history retrieved successfully',
    meta: buildMeta(page, limit, total),
    data: {
      totalDonations: donor.totalDonations,
      lastDonationDate: donor.lastDonationDate,
      donations,
    },
  });
});

const router = Router();
router.get('/my-history', auth(Role.DONOR), getMyDonationHistory);

export const DonationRoutes = router;
