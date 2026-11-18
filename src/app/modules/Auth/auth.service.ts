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

// ---- Google social login (GCP OAuth) ----
// Activates automatically once GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
// GOOGLE_CALLBACK_URL are set in .env (see the OAuth client guide).

const assertGoogleConfigured = () => {
  if (
    !config.google.clientId ||
    !config.google.clientSecret ||
    !config.google.callbackUrl
  ) {
    throw new AppError(
      503,
      'Google login is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing)',
    );
  }
};

const getGoogleAuthUrl = (): string => {
  assertGoogleConfigured();
  const params = new URLSearchParams({
    client_id: config.google.clientId as string,
    redirect_uri: config.google.callbackUrl as string,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

type TGoogleProfile = {
  sub: string;
  email: string;
  name: string;
  email_verified?: boolean;
};

const handleGoogleCallback = async (code: string | undefined) => {
  assertGoogleConfigured();
  if (!code) {
    throw new AppError(400, 'Google authorization code is missing');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId as string,
      client_secret: config.google.clientSecret as string,
      redirect_uri: config.google.callbackUrl as string,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) {
    throw new AppError(401, 'Google token exchange failed');
  }
  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
  };

  const profileResponse = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );
  if (!profileResponse.ok) {
    throw new AppError(401, 'Could not fetch the Google profile');
  }
  const profile = (await profileResponse.json()) as TGoogleProfile;

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ googleId: profile.sub }, { email: profile.email }],
      deletedAt: null,
    },
  });

  if (user && !user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: profile.sub },
    });
  }

  if (!user) {
    // New Google accounts start as DONOR; a hospital can be upgraded by
    // an admin (PATCH /admin/users/:id) after registration.
    user = await prisma.user.create({
      data: {
        name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        googleId: profile.sub,
        role: Role.DONOR,
      },
    });
  }

  if (!user.isActive) {
    throw new AppError(403, 'This account is blocked');
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

export const AuthService = {
  register,
  login,
  refreshToken,
  logout,
  getGoogleAuthUrl,
  handleGoogleCallback,
};
