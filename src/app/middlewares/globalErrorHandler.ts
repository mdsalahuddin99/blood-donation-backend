/* eslint-disable @typescript-eslint/no-unused-vars */
import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import config from '../config';
import AppError from '../errors/AppError';

// Centralized error handler — every error leaves the API in the shape:
// { success: false, message, errors: [] }
const globalErrorHandler: ErrorRequestHandler = (
  err,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500;
  let message = 'Something went wrong';
  let errors: unknown[] = [err?.message || 'Internal server error'];

  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    errors = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = [err.message];
  } else if (err?.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database request error';
    errors = [err.message];
  } else if (err instanceof Error) {
    message = err.message;
    errors = [err.message];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(config.nodeEnv === 'development' ? { stack: err?.stack } : {}),
  });
};

export default globalErrorHandler;
