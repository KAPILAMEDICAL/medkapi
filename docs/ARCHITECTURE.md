# Architecture

## Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), TypeScript, React 18 | One codebase serves server-rendered pages, API routes, and the PWA shell; server components keep data fetching close to the database without a separate API layer for read-heavy admin/customer pages. |
| Styling | Tailwind CSS | Fast, consistent, avoids ad-hoc CSS drift across three portals. |
| Database | PostgreSQL 16 | Relational integrity for orders/payments/ledger (this is money-tracking software — foreign keys and transactions matter), plus `pg_trgm` for real fuzzy product search. |
| ORM | Prisma | Type-safe queries, migrations as code, works well with Next's server components. |
| Auth | Custom OTP + JWT session cookies (`jose`), bcrypt for admin passwords | No third-party auth vendor lock-in; OTP delivery is provider-abstracted (see below) so any SMS gateway can be plugged in later. |
| File storage | Provider-abstracted; local disk in dev | S3-compatible in production without code changes. |
| OCR | Tesseract.js (real, local, no API key) | Genuinely functional out of the box; swappable for a cloud OCR provider at scale. |
| Charts | Recharts | Lightweight, sufficient for the admin dashboard's trend/company charts. |

A monolith (one Next.js app, one Postgres database) was chosen over
microservices deliberately: at this business's scale (one distributor,
one location, thousands of products, dozens of sales staff), a
well-structured monolith is faster to build, easier to reason about, and
cheaper to run — the master prompt's own principle ("avoid complexity
that doesn't reduce work for customer/sales/admin") argues against
premature service splitting.

## Application structure

```
src/
  app/
    (public)              — landing page, /login/*, /register
    customer/              — customer portal (protected)
    sales/                 — sales team portal (protected)
    admin/                 — admin portal (protected)
    api/                   — REST-style route handlers, one folder per resource
  components/
    ui/                    — design system primitives (Button, Card, Input, ...)
    nav/                   — BottomNav, Sidebar, TopBar, per-portal nav wrappers
    product/, sales/, admin/, auth/  — feature-specific components
  lib/
    auth/                  — session, OTP, RBAC
    providers/             — SMS, storage, OCR abstractions
    orders.ts, payments.ts, expenses.ts, notifications.ts, tours.ts
    pricing.ts, search.ts  — pricing/visibility rules, fuzzy product search
    validation.ts          — zod schemas shared by client forms and API routes
    db.ts                  — Prisma client singleton
  middleware.ts             — fast, DB-free first-pass route guard
prisma/
  schema.prisma             — the data model
  migrations/                — versioned SQL migrations
  seed.ts / seed-production.ts
tests/
  unit/                      — vitest
  e2e/                       — playwright
```

## Request flow

A typical write (e.g. booking an order) flows:

`Client component → fetch('/api/orders', POST) → route handler validates
session + zod schema → src/lib/orders.ts (domain logic: pricing, totals,
transaction) → Prisma → Postgres → audit log + notifications written →
JSON response → client redirects to the order confirmation page.`

Reads for server-rendered pages skip the API layer entirely — a page
like `/customer` queries Prisma directly inside its (server) component,
because there's no client-side JS boundary to cross. The API layer under
`/api/*` exists for: (a) client components that need to fetch after the
initial render (search, cart submission), and (b) any future non-web
client (a native mobile app, a partner integration) that would need a
real HTTP API — which is why routes return `{ ok, data }` / `{ ok: false,
error }` consistently rather than mixing server-action conventions.

## Authentication flow

- **Customer / Sales**: mobile number → OTP (5 min TTL, bcrypt-hashed,
  rate-limited) → session cookie (signed JWT, `httpOnly`, `sameSite=lax`).
- **Admin**: mobile/email + password → OTP 2FA sent only after the
  password check passes → session cookie. A generic "invalid credentials"
  message is used for both wrong-password and unknown-account cases to
  avoid account enumeration.
- Every session is also a row in the `Session` table; "logout from all
  devices" revokes every row for a user, taking effect immediately even
  though the JWT itself would still verify — see `src/lib/auth/session.ts`.
- `middleware.ts` is a fast, Postgres-free first pass (Edge runtime
  can't reach Prisma); the authoritative check — including session
  revocation and per-action permission — happens in every page and API
  route via `requireRole()` in `src/lib/auth/rbac.ts`.

## Pricing & visibility rules

A customer's `priceVisibility` (`MRP_ONLY` / `MRP_AND_PTR` / `ALL_PRICES`,
admin-controlled per customer) governs which price fields the API ever
returns to them — see `src/lib/pricing.ts:resolveVisiblePrice`. Order
lines are always priced server-side from the product's actual PTR/MRP,
never from a client-supplied price, closing off the obvious
tampering vector.

## Search

Product search (`src/lib/search.ts`) combines plain substring matching
(so exact SKUs/codes always work) with PostgreSQL `pg_trgm` trigram
similarity (so "parexl" still finds "Parexol") across product name,
composition, and company name — see the `add_trgm_search` migration.
