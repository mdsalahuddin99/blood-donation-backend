import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Day 1 seed: 1 admin, 1 verified hospital, 3 donors.
// Demo passwords are for local evaluation only — change before any real use.
async function main() {
  const saltRounds = 10;

  const adminPassword = await bcrypt.hash('Admin@123', saltRounds);
  const hospitalPassword = await bcrypt.hash('Hospital@123', saltRounds);
  const donorPassword = await bcrypt.hash('Donor@123', saltRounds);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@blooddonation.com' },
    update: {},
    create: {
      name: 'Platform Admin',
      email: 'admin@blooddonation.com',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      phone: '+8801700000000',
    },
  });

  const hospitalUser = await prisma.user.upsert({
    where: { email: 'hospital@blooddonation.com' },
    update: {},
    create: {
      name: 'Dhaka Medical Coordinator',
      email: 'hospital@blooddonation.com',
      passwordHash: hospitalPassword,
      role: Role.HOSPITAL,
      phone: '+8801800000000',
      hospitalProfile: {
        create: {
          hospitalName: 'Dhaka Medical College Hospital',
          registrationNo: 'DMCH-001',
          district: 'Dhaka',
          address: 'Secretariat Road, Dhaka 1000',
          contactPerson: 'Blood Bank Desk',
          isVerified: true,
        },
      },
    },
  });

  const donors = [
    {
      name: 'Rahim Uddin',
      email: 'rahim.donor@example.com',
      bloodGroup: 'O_NEGATIVE' as const,
      district: 'Dhaka',
      area: 'Mirpur',
    },
    {
      name: 'Karim Ahmed',
      email: 'karim.donor@example.com',
      bloodGroup: 'A_POSITIVE' as const,
      district: 'Dhaka',
      area: 'Uttara',
    },
    {
      name: 'Jamal Hossain',
      email: 'jamal.donor@example.com',
      bloodGroup: 'B_POSITIVE' as const,
      district: 'Chattogram',
      area: 'Pahartali',
    },
  ];

  for (const donor of donors) {
    await prisma.user.upsert({
      where: { email: donor.email },
      update: {},
      create: {
        name: donor.name,
        email: donor.email,
        passwordHash: donorPassword,
        role: Role.DONOR,
        donorProfile: {
          create: {
            bloodGroup: donor.bloodGroup,
            district: donor.district,
            area: donor.area,
            isAvailable: true,
          },
        },
      },
    });
  }

  console.log('Seed complete:', {
    admin: admin.email,
    hospital: hospitalUser.email,
    donors: donors.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
