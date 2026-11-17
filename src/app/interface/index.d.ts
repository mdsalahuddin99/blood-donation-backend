import { Role } from '@prisma/client';

export type TAuthUser = {
  userId: string;
  email: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: TAuthUser;
    }
  }
}

export {};
