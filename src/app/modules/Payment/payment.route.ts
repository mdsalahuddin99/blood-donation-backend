import { Request, Response, Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import auth from '../../middlewares/auth';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import validateRequest from '../../middlewares/validateRequest';
import { PaymentService } from './payment.service';

const initiateValidationSchema = z.object({
  body: z.object({
    requestId: z.string({ required_error: 'requestId is required' }).uuid(),
  }),
});

const initiate = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.initiateBroadcastPayment(
    req.user!,
    req.body,
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Payment session created. Complete the payment to activate the broadcast.',
    data: result,
  });
});

// Stripe calls this endpoint directly — no auth, signature-verified instead.
// The raw body is preserved by the express.raw parser mounted in app.ts.
const webhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string | undefined;
  const result = await PaymentService.handleWebhook(
    req.body as Buffer,
    signature,
  );
  res.status(200).json(result);
});

const paymentSuccess = catchAsync(async (req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      'Payment completed. The broadcast activates as soon as the webhook confirms it.',
    data: { sessionId: req.query.session_id ?? null },
  });
});

const paymentCancel = catchAsync(async (req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment was cancelled. The broadcast was not activated.',
    data: { sessionId: req.query.session_id ?? null },
  });
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const payment = await PaymentService.getPaymentById(req.user!, req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment retrieved successfully',
    data: payment,
  });
});

const listMyPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.listMyPayments(req.user!, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payments retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const router = Router();

router.post(
  '/initiate',
  auth(Role.HOSPITAL),
  validateRequest(initiateValidationSchema),
  initiate,
);
router.post('/webhook', webhook);
router.get('/success', paymentSuccess);
router.get('/cancel', paymentCancel);
router.get('/my-payments', auth(), listMyPayments);
router.get('/:id', auth(), getPaymentById);

export const PaymentRoutes = router;
