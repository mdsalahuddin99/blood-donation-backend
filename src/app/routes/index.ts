import { Router } from 'express';
import { AdminRoutes } from '../modules/Admin/admin.route';
import { AuthRoutes } from '../modules/Auth/auth.route';
import { BloodRequestRoutes } from '../modules/BloodRequest/bloodRequest.route';
import { DonationRoutes } from '../modules/Donation/donation.route';
import { DonorRoutes } from '../modules/Donor/donor.route';
import { HospitalRoutes } from '../modules/Hospital/hospital.route';
import { NotificationRoutes } from '../modules/Notification/notification.route';
import { PaymentRoutes } from '../modules/Payment/payment.route';
import { UserRoutes } from '../modules/User/user.route';

const router = Router();

type TModuleRoute = {
  path: string;
  route: Router;
};

const moduleRoutes: TModuleRoute[] = [
  { path: '/auth', route: AuthRoutes },
  { path: '/users', route: UserRoutes },
  { path: '/donors', route: DonorRoutes },
  { path: '/hospitals', route: HospitalRoutes },
  { path: '/blood-requests', route: BloodRequestRoutes },
  { path: '/donations', route: DonationRoutes },
  { path: '/notifications', route: NotificationRoutes },
  { path: '/payments', route: PaymentRoutes },
  { path: '/admin', route: AdminRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
