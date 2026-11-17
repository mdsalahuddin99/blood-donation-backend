import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import AppError from '../errors/AppError';
import prisma from '../utils/prisma';
import { verifyAccessToken } from '../utils/jwt';
import catchAsync from '../utils/catchAsync';

// Authentication + role-based authorization middleware.
// Usage: auth() -> any logged-in user; auth(Role.ADMIN) -> only that role.
const auth = (...requiredRoles: Role[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError(401, 'Unauthorized: no access token provided');
    }

    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.deletedAt) {
      throw new AppError(401, 'Unauthorized: user no longer exists');
    }
    if (!user.isActive) {
      throw new AppError(403, 'Forbidden: this account is blocked');
    }
    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      throw new AppError(
        403,
        'Forbidden: you do not have permission to access this resource',
      );
    }

    req.user = { userId: user.id, email: user.email, role: user.role };
    next();
  });
};

export default auth;
