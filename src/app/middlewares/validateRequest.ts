import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';

// Server-side validation for body/query/params using Zod schemas.
// Detailed usage starts Day 2/Day 3 with the module routes.
const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      });
      next();
    } catch (err) {
      next(err);
    }
  };
};

export default validateRequest;
