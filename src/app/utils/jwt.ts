import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import config from '../config';
import AppError from '../errors/AppError';
import { TAuthUser } from '../interface';

export const createAccessToken = (payload: TAuthUser): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.accessExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwt.accessSecret, options);
};

export const createRefreshToken = (payload: TAuthUser): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwt.refreshSecret, options);
};

export const verifyAccessToken = (token: string): TAuthUser => {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    return {
      userId: decoded.userId as string,
      email: decoded.email as string,
      role: decoded.role,
    } as TAuthUser;
  } catch {
    throw new AppError(401, 'Invalid or expired access token');
  }
};

export const verifyRefreshToken = (token: string): TAuthUser => {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
    return {
      userId: decoded.userId as string,
      email: decoded.email as string,
      role: decoded.role,
    } as TAuthUser;
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }
};
