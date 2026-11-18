import Stripe from 'stripe';
import {
  PaymentPurpose,
  PaymentStatus,
  RequestStatus,
} from '@prisma/client';
import config from '../../config';
import AppError from '../../errors/AppError';
import { TAuthUser } from '../../interface';
import prisma from '../../utils/prisma';
import { buildMeta, parsePagination } from '../../utils/pagination';
import {
  compatibleDonorGroups,
  isEligibleToDonate,
} from '../../utils/bloodCompatibility';
import { createAuditLog } from '../../utils/audit';
import { createNotifications } from '../../utils/notification';

// Emergency broadcast fee: USD 5.00 (Stripe test mode amounts are in cents).
export const BROADCAST_FEE_CENTS = 500;
export const BROADCAST_CURRENCY = 'usd';

const getStripe = (): Stripe => {
  if (!config.stripe.secretKey) {
    throw new AppError(
      503,
      'Payment gateway is not configured (STRIPE_SECRET_KEY missing)',
    );
  }
  return new Stripe(config.stripe.secretKey);
};

const initiateBroadcastPayment = async (
  authUser: TAuthUser,
  payload: { requestId: string },
) => {
  const stripe = getStripe();

  const hospital = await prisma.hospitalProfile.findUnique({
    where: { userId: authUser.userId },
  });
  if (!hospital) {
    throw new AppError(400, 'Create your hospital profile first');
  }

  const request = await prisma.bloodRequest.findFirst({
    where: { id: payload.requestId, hospitalId: hospital.id, deletedAt: null },
  });
  if (!request) {
    throw new AppError(404, 'Blood request not found');
  }
  if (
    request.status === RequestStatus.COMPLETED ||
    request.status === RequestStatus.CANCELLED
  ) {
    throw new AppError(400, 'This request can no longer be broadcast');
  }
  if (request.broadcastEnabled) {
    throw new AppError(400, 'Emergency broadcast is already active');
  }

  const payment = await prisma.payment.create({
    data: {
      userId: authUser.userId,
      requestId: request.id,
      amount: BROADCAST_FEE_CENTS / 100,
      currency: BROADCAST_CURRENCY,
      purpose: PaymentPurpose.EMERGENCY_BROADCAST,
      gateway: 'stripe',
      status: PaymentStatus.PENDING,
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: BROADCAST_CURRENCY,
          product_data: {
            name: `Emergency broadcast — blood request for ${request.patientName}`,
          },
          unit_amount: BROADCAST_FEE_CENTS,
        },
        quantity: 1,
      },
    ],
    success_url: `${config.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.stripe.cancelUrl}?session_id={CHECKOUT_SESSION_ID}`,
    metadata: { paymentId: payment.id, requestId: request.id },
  });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { sessionId: session.id },
  });

  return { payment: updated, checkoutUrl: session.url };
};

const handleWebhook = async (
  rawBody: Buffer,
  signature: string | undefined,
) => {
  const stripe = getStripe();
  if (!config.stripe.webhookSecret) {
    throw new AppError(503, 'Stripe webhook secret is not configured');
  }
  if (!signature) {
    throw new AppError(400, 'Missing Stripe signature');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhookSecret,
    );
  } catch {
    throw new AppError(400, 'Invalid Stripe webhook signature');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.paymentId;

    if (paymentId) {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (payment && payment.status !== PaymentStatus.PAID) {
        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.PAID,
            transactionId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.id,
          },
        });

        if (payment.requestId) {
          await activateBroadcast(payment.requestId);
        }
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      await prisma.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.CANCELLED },
      });
    }
  }

  return { received: true };
};

// After a successful broadcast payment: enable the broadcast and notify
// every compatible, available, eligible donor.
const activateBroadcast = async (requestId: string) => {
  const request = await prisma.bloodRequest.update({
    where: { id: requestId },
    data: { broadcastEnabled: true },
  });

  const donorGroups = compatibleDonorGroups(request.bloodGroup);
  const candidates = await prisma.donorProfile.findMany({
    where: {
      bloodGroup: { in: donorGroups },
      isAvailable: true,
      deletedAt: null,
    },
    select: { userId: true, lastDonationDate: true },
  });

  const now = new Date();
  const inputs = candidates
    .filter((donor) => isEligibleToDonate(donor.lastDonationDate, now))
    .map((donor) => ({
      userId: donor.userId,
      type: 'EMERGENCY_BROADCAST',
      title: `Urgent: ${request.bloodGroup} blood needed in ${request.district}`,
      message: `A ${request.urgency} request for ${request.unitsNeeded} unit(s) was posted by a hospital in ${request.district}. You are a compatible donor — please respond if you can donate.`,
      relatedRequestId: request.id,
    }));

  await createNotifications(inputs);
  await createAuditLog(null, 'BROADCAST_ACTIVATED', 'BloodRequest', requestId, {
    notifiedDonors: inputs.length,
  });
};

const getPaymentById = async (authUser: TAuthUser, id: string) => {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) {
    throw new AppError(404, 'Payment not found');
  }
  if (authUser.role !== 'ADMIN' && payment.userId !== authUser.userId) {
    throw new AppError(403, 'This is not your payment');
  }
  return payment;
};

const listMyPayments = async (
  authUser: TAuthUser,
  query: { page?: string; limit?: string },
) => {
  const { page, limit, skip } = parsePagination(query);
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId: authUser.userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.count({ where: { userId: authUser.userId } }),
  ]);
  return { meta: buildMeta(page, limit, total), data: payments };
};

export const PaymentService = {
  initiateBroadcastPayment,
  handleWebhook,
  getPaymentById,
  listMyPayments,
};
