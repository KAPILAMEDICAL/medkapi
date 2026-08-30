# Security

## What's implemented

- **Authentication**: OTP (customer/sales) and password + OTP 2FA (admin).
  OTP codes are bcrypt-hashed at rest (`src/lib/auth/otp.ts`), never
  stored or logged in plaintext outside the dev-only console SMS provider.
- **OTP hardening**: 5-minute expiry, 5 verify-attempt cap, 45-second
  resend cooldown, 5-requests-per-30-minutes rolling cap per mobile
  number. Verified live in this repo — see the "Too many OTP requests"
  behavior in `docs/DEPLOYMENT.md` and `tests/e2e/admin-flow.spec.ts`.
- **Sessions**: signed JWT (`HS256`, `AUTH_SECRET`) in an `httpOnly`,
  `sameSite=lax` cookie (`secure` in production), backed by a `Session`
  row so revocation ("logout from all devices") is immediate rather than
  waiting for JWT expiry. Session tokens are stored server-side only as a
  SHA-256 hash.
- **Authorization**: role-based (`SUPER_ADMIN / ADMIN / SALES_MANAGER /
  SALES_BOY / CUSTOMER / ACCOUNTS`), enforced in `src/lib/auth/rbac.ts`
  on every page and API route — `middleware.ts` is a fast Edge-layer
  first pass only, never the sole check, since it cannot see session
  revocation (Edge runtime has no Prisma/DB access).
- **Password hashing**: bcrypt, admin accounts only (the only role with
  passwords).
- **Input validation**: zod schemas (`src/lib/validation.ts`) on every
  API route's request body — the same schemas back client-side form
  validation, so the rules can't drift.
- **File upload security**: real file-signature (magic byte) sniffing
  (`src/lib/providers/storage.ts:validateUploadedFile`) — the client's
  claimed MIME type and filename are never trusted. Only JPG/PNG/PDF are
  accepted; 8&nbsp;MB size cap; server-generated filenames (no path
  traversal or overwrite via a crafted original filename).
- **SQL injection**: Prisma's query builder is used everywhere except
  the fuzzy-search and dashboard-aggregate queries, which use
  `Prisma.sql`/tagged-template `$queryRaw` — parameterized, never string
  concatenation.
- **XSS**: React's default escaping everywhere; no `dangerouslySetInnerHTML`
  anywhere in the codebase.
- **Price/data authorization**: order lines are always priced server-side
  from the actual product record (`src/lib/pricing.ts`), never trusting a
  client-supplied price; a customer's `priceVisibility` setting is
  enforced on every product-returning endpoint so trade pricing (PTR/PTS)
  is never sent to an unauthorized viewer.
- **Audit log**: `AuditLog` rows are written for login, customer
  approval/rejection, order status changes, payment status changes,
  product price changes, expense approve/reject, offer/settings changes
  — see `src/lib/audit.ts` and its call sites.
- **Account enumeration resistance**: admin login returns the same
  generic error for "unknown account" and "wrong password".
- **Location consent**: GPS coordinates on a `Visit` are only ever
  populated when the browser's geolocation permission was granted for
  that specific visit (`locationConsent` flag) — never collected silently.
- **Error handling**: `src/lib/api-response.ts:fail()` converts every
  thrown error into a safe, generic message unless it's one of a small
  set of "expected, user-safe" error classes; raw errors are logged
  server-side only, never returned to the client.

## Honest gaps / what a real production launch still needs

- **CSRF**: same-site cookies + JSON-only POST/PATCH bodies (no
  form-encoded submissions that a `<form action>` from another origin
  could trigger) mitigate the classic CSRF vector, but no explicit
  double-submit CSRF token is implemented. Low risk given the above, but
  worth adding before handling very large transaction volumes.
- **Rate limiting** is currently OTP-specific (DB-backed) and not applied
  to every API route generally — a reverse proxy / edge rate limiter
  (e.g. Cloudflare, or `next-safe`/`upstash-ratelimit`) should sit in
  front of the whole app in production.
- **HTTPS** is assumed to be terminated by the deployment platform/load
  balancer (Docker Compose here does not include a TLS terminator) — see
  `docs/DEPLOYMENT.md`.
- **SMS/OCR/storage providers** ship with dev-only implementations by
  design (see `README.md`); a real deployment must configure the
  production providers before go-live, or OTPs will only ever appear in
  server logs.
- **Secrets**: `.env` is git-ignored; `AUTH_SECRET` and DB credentials
  must be generated fresh per environment and never reused between
  staging and production.

## Backup strategy (recommended)

- Nightly `pg_dump` of the PostgreSQL database, retained for at least 30
  days, stored off the application host (e.g. in the same S3 bucket used
  for `STORAGE_PROVIDER=s3` file uploads, under a separate prefix).
- If using local-disk file storage in a non-production evaluation
  deployment, back up the `uploads` volume alongside the database dump —
  in real production, switch to S3-compatible storage instead, which is
  durable by default.

## Logging & error monitoring (recommended)

- Route handlers already log unexpected errors server-side via
  `console.error('[api-error]', err)` in `src/lib/api-response.ts` — wire
  this into a real error monitoring service (Sentry, or your platform's
  log aggregation) in production rather than relying on container logs.
- Audit log entries (`AuditLog` table) are the source of truth for
  "who did what" — export or mirror them to a write-once store if
  regulatory retention requirements apply.
