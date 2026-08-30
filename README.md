# Kapila Medical Agencies — Digital Distribution Platform

Pharmaceutical Wholesale & Distribution · Sirsi, Uttara Kannada, Karnataka

A production-grade web application for a pharmaceutical wholesale
distributor, built around three role-based portals — **Customer**,
**Sales Team**, and **Admin** — backed by a single PostgreSQL database.
Every workflow described below is real and functional: OTP login,
product search, order booking, payment collection, expense OCR, tour
scheduling, and admin analytics all read and write actual database
records. Nothing is mocked except the two things that legitimately
require paid third-party accounts to go live (SMS delivery and file
storage) — those are built as clean, swappable provider interfaces (see
[Provider abstractions](#provider-abstractions--production-integration-points)).

## Quick start (local development)

```bash
cp .env.example .env          # edit DATABASE_URL / SUPER_ADMIN_* if needed
npm install
npm run db:migrate            # applies prisma/migrations against your Postgres
npm run db:seed               # loads labeled DEMO DATA for local development
npm run dev                   # http://localhost:3000
```

Requires Node 20+ and a PostgreSQL 14+ database (with the `pg_trgm`
extension available — the migration enables it for you).

Demo login credentials after seeding (see `prisma/seed.ts`):

| Role | Mobile | Password |
|---|---|---|
| Super Admin | `9900000000` | `ChangeMe@123` (then OTP) |
| Sales Manager | `9900000001` | `Manager@123` (then OTP) |
| Sales Boy | `9900000010` / `9900000011` | OTP only |
| Customer | `9900001001`–`9900001004` | OTP only |

In development, OTPs are printed to the server console (`SMS_PROVIDER=console`)
rather than sent as real SMS — see [Provider abstractions](#provider-abstractions--production-integration-points).

## The three portals

- **`/customer`** — medical shops, pharmacies, hospitals, clinics: search
  products, browse companies, see offers, book orders, track order status,
  view their account statement.
- **`/sales`** — the field sales team: today's tour, customer visits
  (with GPS only on explicit browser permission), order booking on behalf
  of a customer, payment collection, expense submission with real OCR bill
  reading.
- **`/admin`** — the business: dashboard/analytics, customer approval,
  product/company/offer catalog management, order fulfillment workflow,
  payment verification, expense approval, sales-team & tour management,
  settings.

Each portal has its own login (`/login/customer`, `/login/sales`,
`/login/admin`) and is protected both at the edge (`src/middleware.ts`)
and, authoritatively, in every page/API route (`src/lib/auth/rbac.ts`).

## Provider abstractions (production integration points)

Three external capabilities are implemented behind small, documented
interfaces so a production deployment can plug in real providers without
touching application code:

| Capability | Interface | Dev implementation | Production TODO |
|---|---|---|---|
| SMS / OTP delivery | `src/lib/providers/sms.ts` | Logs OTP to console | Implement an `Msg91SmsProvider` (or any DLT-registered Indian SMS gateway) |
| File storage | `src/lib/providers/storage.ts` | Local disk under `public/uploads` | Implement an `S3StorageProvider` (AWS S3 / R2 / Spaces) |
| OCR (bill reading) | `src/lib/providers/ocr.ts` | **Real** Tesseract.js OCR — genuinely reads bills, no API key needed | Optionally swap for Google Vision / AWS Textract at scale |

Nothing in the app pretends these work when they don't: the OCR is
real and tested (see `tests/unit/ocr-extraction.test.ts`), and the SMS/
storage providers are clearly logged as dev-only every time they're used.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture, tech stack rationale, application structure
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — entity model and design decisions
- [`docs/API.md`](docs/API.md) — REST API reference
- [`docs/SECURITY.md`](docs/SECURITY.md) — security controls and checklist
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Docker deployment, environment variables, real-data import, backups

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (next/core-web-vitals)
npm test            # vitest — 46 unit tests (pricing, OCR extraction, validation, file-signature security, id generation)
npm run test:e2e    # playwright — 4 end-to-end specs against a real production build + Postgres
```

All four commands are green in this repository. The e2e suite spins up
`npm run build && npm run start` on its own port and drives real browser
flows: customer self-registration + pending-approval messaging, an
approved customer searching a product and booking a real order, a
salesman logging in and viewing their tour, and a super admin logging in
with password+OTP 2FA and approving a new customer.

## Project phases (as delivered)

This repository was built in the following order, matching the Master
Prompt's phased approach:

1. **Architecture** — Next.js 15 (App Router) + TypeScript + Tailwind CSS,
   PostgreSQL + Prisma, provider-abstraction pattern for external services.
   See `docs/ARCHITECTURE.md`.
2. **Database schema** — 26 models covering identity, customers, sales
   team, catalog, orders, payments/ledger, expenditure (expenses,
   categories, advances, settlements), tours/visits, notifications, audit
   log, settings. See `docs/DATABASE_SCHEMA.md`.
3. **User roles & permissions** — `SUPER_ADMIN`, `ADMIN`, `SALES_MANAGER`,
   `SALES_BOY`, `CUSTOMER`, `ACCOUNTS`, enforced in `src/lib/auth/rbac.ts`
   and re-checked on every route (middleware is a fast first pass only).
4. **Application structure** — `src/app/{customer,sales,admin}` route
   groups, `src/lib` domain services, `src/components` design system.
5. **Design system** — restrained brand palette, `src/components/ui/*`
   (Button, Card, Input, Badge, StatCard, EmptyState, Table, nav).
6. **Core UI** — responsive, mobile-first layouts with bottom navigation
   for customer/sales and a sidebar for admin.
7. **Authentication** — OTP login (customer/sales) and password+OTP 2FA
   (admin), signed session cookies, session revocation, rate limiting.
8. **Customer portal** — dashboard, fuzzy product search, product pages,
   cart, order booking, order tracking, companies directory, offers,
   account statement with CSV export.
9. **Sales team portal** — dashboard with targets, today's tour, visit
   workflow (with consent-gated location), order booking on behalf,
   payment collection, expense submission with OCR.
10. **Admin portal** — analytics dashboard with charts, customer
    approval, product/company/offer CRUD, order fulfillment workflow,
    payment verification, expense approval, sales-team management, tour
    scheduling, settings.
11. **Orders** — `src/lib/orders.ts`: server-priced, transactional order
    booking shared by customer and sales flows; full status workflow.
12. **Payments** — `src/lib/payments.ts`: cash/UPI/bank/cheque entry,
    ledger-synced, admin verification.
13. **Expenditure management** — `src/lib/expenses.ts`,
    `src/lib/expense-advances.ts`, `src/lib/expenditure-reports.ts` + real
    Tesseract.js OCR with an always-editable confirmation step before
    saving. Covers both bill-photo and manual entry, admin-configurable
    categories and limits, consent-gated GPS capture, duplicate-bill
    detection, an approve/reject/request-correction/reimburse workflow
    with locked-after-approval records, travel advances, month-end
    settlement, and per-salesman expense-to-sales analytics.
14. **Tour + GPS** — admin-created tour schedules, salesman visit
    start/finish, browser-permission-gated location capture.
15. **Reports & analytics** — admin dashboard KPIs, 14-day sales trend,
    company-wise sales, salesman performance, "what needs attention today".
16. **Testing** — 46 unit tests + 4 Playwright e2e specs (see above).
17. **Deployment** — `Dockerfile` (multi-stage, standalone Next.js
    output) + `docker-compose.yml`, `.env.example`, production seed
    script. See `docs/DEPLOYMENT.md`.

## What is intentionally out of scope for v1

Being explicit about scope, per the platform's own principle of never
hiding unfinished functionality:

- **Excel/CSV bulk import UI** for products/customers (the schema and
  admin CRUD are ready for it; the upload/preview/validate workflow
  itself is not yet built — the fastest path in is the admin API).
- **Live GPS map rendering** in Today's Tour (coordinates are captured
  and stored with consent; no map tile provider is wired up, to avoid
  shipping a paid API key by default — see `MAPS_PROVIDER` in `.env.example`).
- **WhatsApp/native share sheets** for orders/receipts (share-friendly
  URLs exist; OS-level share integration is a follow-up).
- **Excel (.xlsx) / server-rendered PDF expense reports** — reports
  export as CSV today (opens cleanly in Excel/Sheets); the approved
  expense receipt is a print-styled HTML page (browser "Print → Save as
  PDF") rather than a server-generated PDF file.
- **Live GPS map rendering** for expense locations (same limitation as
  Today's Tour above — coordinates are captured and a "view on map" link
  opens Google Maps; there's no in-app map tile view).
- Multi-tenant / multi-branch support (this build targets one
  distributor, one location).
