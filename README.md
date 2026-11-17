# Blood Donation & Emergency Platform — Backend API

A backend-focused REST API that connects verified blood donors with hospitals during emergencies: hospitals post blood requests, the system matches compatible and eligible donors, donors respond, and hospitals can pay (Stripe) to broadcast critical requests to every matching donor nearby.

> B7A6 Backend Project · No frontend — all functionality is demonstrated via Postman / Thunder Client.

## Tech Stack

| Category | Technology |
|---|---|
| Runtime & Framework | Node.js, TypeScript, Express.js |
| Database & ORM | PostgreSQL + Prisma |
| Validation | Zod |
| Auth | JWT (Bearer) — Email/Password + Google social login, 3 roles |
| Payments | Stripe (initiate → webhook verify → status tracking) |
| Build & Deploy | TSUP build, Vercel serverless deployment |
| Docs | Postman collection (added Day 4) |

## Roles

| Role | Can do |
|---|---|
| `DONOR` | Donor profile & availability, view requests, respond, donation history |
| `HOSPITAL` | Create blood requests for patients, find matching donors, confirm donations, pay for emergency broadcast |
| `ADMIN` | Verify requests & hospitals, manage users, dashboard stats, audit logs |

## Core Business Rules

- **Blood compatibility matching** — O− is the universal donor, AB+ the universal recipient; the matching API only returns compatible donors.
- **90-day eligibility** — a donor cannot respond until 90 days have passed since their last donation.
- **No duplicate response** — one donor, one response per request (unique constraint).
- **Transaction-safe units** — `unitsFulfilled` can never exceed `unitsNeeded`; confirmation runs inside a Prisma transaction.
- **Emergency broadcast is paid** — a CRITICAL request notifies all matching donors only after the Stripe payment succeeds.

## Getting Started

```bash
# 1. Install dependencies (Bun per guideline, npm works too)
bun install        # or: npm install

# 2. Configure environment
cp .env.example .env   # then fill in DATABASE_URL and secrets

# 3. Prisma: generate client + first migration
bunx prisma generate
bunx prisma migrate dev --name init

# 4. Seed demo data
npm run seed

# 5. Run in development
npm run dev        # tsx watch src/server.ts
```

## Demo Credentials (seed data only)

| Role | Email | Password |
|---|---|---|
| Admin | admin@blooddonation.com | Admin@123 |
| Hospital | hospital@blooddonation.com | Hospital@123 |
| Donor | rahim.donor@example.com | Donor@123 |

## API Overview

Base URL: `/api/v1` · All responses follow `{ success, message, data }` / `{ success: false, message, errors: [] }`.

27 endpoints across Auth, Users/Profile, Donor Search, Blood Requests, Donations, Notifications, Payments and Admin — built day by day (Day 2: Auth & core APIs, Day 3: business logic, Day 4: payments & Postman docs, Day 5: deployment & video).

## Deployment

Built with TSUP (`npm run build` → `dist/server.js`) and deployed to Vercel using the included `vercel.json`. Set all `.env.example` variables in the Vercel dashboard before deploying. Serverless note: no cron jobs, WebSockets, local file storage or in-memory state — use external services (Upstash Redis, Cloudinary) where needed.
