import { z } from 'zod';
import { Role } from '@prisma/client';

// Self-registration is open for DONOR and HOSPITAL only.
// ADMIN accounts are created via seed / by an existing admin.
const registerValidationSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(2).max(80),
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(6, 'Password must be at least 6 characters')
      .max(64),
    role: z.enum([Role.DONOR, Role.HOSPITAL], {
      required_error: 'Role is required',
    }),
    phone: z.string().min(6).max(20).optional(),
  }),
});

const loginValidationSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format'),
    password: z.string({ required_error: 'Password is required' }),
  }),
});

export const AuthValidation = {
  registerValidationSchema,
  loginValidationSchema,
};
