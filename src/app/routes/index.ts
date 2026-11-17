import { Router } from 'express';

const router = Router();

type TModuleRoute = {
  path: string;
  route: Router;
};

// Module routes are registered here day by day:
// Day 2 -> /auth, /users, /donors
// Day 3 -> /blood-requests, /donations, /notifications
// Day 4 -> /payments, /admin
const moduleRoutes: TModuleRoute[] = [];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
