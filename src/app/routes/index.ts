import { Router } from 'express';
import { AuthRoutes } from '../modules/Auth/auth.route';
import { DonorRoutes } from '../modules/Donor/donor.route';
import { HospitalRoutes } from '../modules/Hospital/hospital.route';
import { UserRoutes } from '../modules/User/user.route';

const router = Router();

type TModuleRoute = {
  path: string;
  route: Router;
};

// Day 2 -> /auth, /users, /donors, /hospitals
// Day 3 -> /blood-requests, /donations, /notifications
// Day 4 -> /payments, /admin
const moduleRoutes: TModuleRoute[] = [
  { path: '/auth', route: AuthRoutes },
  { path: '/users', route: UserRoutes },
  { path: '/donors', route: DonorRoutes },
  { path: '/hospitals', route: HospitalRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
