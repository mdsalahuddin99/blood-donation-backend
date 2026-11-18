import prisma from './prisma';

type TNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedRequestId?: string;
};

// In-app notification row. Delivery failures must not break the main flow.
export const createNotification = async (
  input: TNotificationInput,
): Promise<void> => {
  try {
    await prisma.notification.create({ data: input });
  } catch {
    // intentionally silent
  }
};

export const createNotifications = async (
  inputs: TNotificationInput[],
): Promise<void> => {
  if (inputs.length === 0) return;
  try {
    await prisma.notification.createMany({ data: inputs });
  } catch {
    // intentionally silent
  }
};
