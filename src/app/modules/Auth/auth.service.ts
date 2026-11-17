import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import config from '../../config';
import AppError from '../../errors/AppError';
import prisma from '../../utils/prisma';
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';

type TRegisterPayload = {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
};

type TLoginPayload = {
  email: string;
  password: string;
};

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // matches JWT_REFRESH_EXPIRES_IN default (7d)

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const issueTokens = async (user: {
  id: string;
  email: string;
  role: Role;
}) => {
  const payload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = createAccessToken(payload);
  const refreshToken = createRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
};

const register = async (payload: TRegisterPayload) => {
  const existing = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (existing) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(
    payload.password,
    config.bcryptSaltRounds,
  );

  const user = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      passwordHash,
      role: payload.role,
      phone: payload.phone,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
    },
  });

  return user;
};

const login = async (payload: TLoginPayload) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user || user.deletedAt) {
    throw new AppError(401, 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new AppError(403, 'This account is blocked');
  }
  if (!user.passwordHash) {
    throw new AppError(
      401,
      'This account uses social login. Please continue with Google.',
    );
  }

  const matched = await bcrypt.compare(payload.password, user.passwordHash);
  if (!matched) {
    throw new AppError(401, 'Invalid email or password');
  }

  const tokens = await issueTokens(user);

  return {
    ...tokens,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

const refreshToken = async (token: string | undefined) => {
  if (!token) {
    throw new AppError(401, 'Refresh token not provided');
  }

  const decoded = verifyRefreshToken(token);

  const stored = await prisma.refreshToken.findFirst({
    where: {
      userId: decoded.userId,
      tokenHash: hashToken(token),
      expiresAt: { gt: new Date() },
    },
  });
  if (!stored) {
    throw new AppError(401, 'Refresh token is invalid or has been revoked');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || user.deletedAt || !user.isActive) {
    throw new AppError(401, 'Account is not available');
  }

  // Rotate: revoke the used token, issue a fresh pair.
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const tokens = await issueTokens(user);

  return tokens;
};

const logout = async (token: string | undefined) => {
  if (token) {
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
};

export const AuthService = {
  register,
  login,
  refreshToken,
  logout,
};
