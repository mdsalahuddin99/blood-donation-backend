import { Request, Response, Router } from 'express';
import AppError from '../../errors/AppError';
import auth from '../../middlewares/auth';
import catchAsync from '../../utils/catchAsync';
import prisma from '../../utils/prisma';
import sendResponse from '../../utils/sendResponse';
import { buildMeta, parsePagination } from '../../utils/pagination';

const listMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const isReadFilter =
    req.query.isRead !== undefined
      ? { isRead: req.query.isRead === 'true' }
      : {};

  const where = { userId: req.user!.userId, ...isReadFilter };
  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId: req.user!.userId, isRead: false },
    }),
  ]);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notifications retrieved successfully',
    meta: buildMeta(page, limit, total),
    data: { unreadCount: unread, notifications },
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!notification) {
    throw new AppError(404, 'Notification not found');
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notification marked as read',
    data: updated,
  });
});

const router = Router();
router.get('/', auth(), listMyNotifications);
router.patch('/:id/read', auth(), markAsRead);

export const NotificationRoutes = router;
