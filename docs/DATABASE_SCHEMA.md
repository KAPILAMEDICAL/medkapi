# Database Schema

Full source of truth: `prisma/schema.prisma`. This document explains the
*why* behind the model, not just the *what*.

## Entity groups

**Identity & auth** — `User` is the single identity table for every
role; `Customer` and `Salesman` are 1:1 profile tables hanging off it
(admin-type roles use `User` directly with no extra profile). This
avoids duplicating mobile/email/auth fields across role tables and lets
one person's role change (e.g. sales boy promoted to sales manager)
without a data migration. `OtpVerification` and `Session` are separate
tables so OTP codes (short-lived, hashed) and login sessions (longer-lived,
revocable) can have independent lifecycle rules.

**Catalog** — `Company → Division → Product`, with a separate
`Category` tree (many-to-one from Product, not nested under Company,
since a category like "Antibiotics" spans companies). `Product` carries
both consumer-facing fields (name, image, composition) and trade fields
(MRP, PTR, PTS, GST%) — visibility of the trade fields is a runtime
decision (`src/lib/pricing.ts`), not a separate table, since the same
product record is shown to a customer, a salesman, and an admin with
different redaction rules.

**Orders & ledger** — `Order` has `OrderItem` children (standard
header/line pattern). Every order also writes exactly one `LedgerEntry`
(an `INVOICE` debit); every payment writes exactly one `LedgerEntry` (a
`PAYMENT` credit). This makes a customer's account statement an
append-only, chronologically ordered read of `LedgerEntry` rather than a
live re-aggregation of orders and payments — correct even years later,
and it's how real accounting ledgers work. `balanceAfter` is computed
and stored at write time specifically so statement rendering never has
to re-sum history.

**Payments** — modeled separately from ledger entries because a payment
has its own lifecycle (`PENDING → VERIFIED/REJECTED`, or
`PENDING → CLEARED/BOUNCED` for cheques) independent of the ledger
entry it produced.

**Expenditure** — `Expense` carries both the salesman's confirmed values
(amount, category, date — what's actually saved and reviewed) and the
raw OCR output (`ocrRawText`, `ocrConfidence`, `ocrProvider`) purely as
an audit trail of what the AI extracted, never as the source of truth.
Category is a foreign key to `ExpenseCategoryConfig` rather than an enum
so admins can add/rename/retire categories without a migration. GPS
fields mirror `Visit`'s consent-gated pattern — nullable, populated only
when the browser granted permission. `isLocked` enforces the "no silent
edits to an approved record" rule: once `APPROVED`/`REIMBURSED` it can
only be edited after a `SUPER_ADMIN` explicitly reopens it
(`reopenedByUserId`/`reopenedAt`), and every edit — including the
reopen — writes to the generic `AuditLog`, so there is no separate
expense-specific history table. `ExpenseAdvance` records cash given to a
salesman for field travel; `ExpenseSettlement` is a point-in-time
snapshot of one salesman's advance-vs-approved-expense reconciliation
for a period (opening/new advance, approved expenses, closing balance,
direction). Closing a settlement stamps `settlementId` onto every
advance/expense it covers so a later settlement never double-counts
them — the settlement is a real ledger event, not a derived report.

**Tours & visits** — `TourSchedule` (one per salesman per day) has
`TourStop` children (planned); `Visit` is the actual field visit, linked
1:1 to a `TourStop` when it originated from one, but also constructible
standalone (an unplanned customer drop-in). Location fields on `Visit`
are nullable and gated by `locationConsent` — never populated without it.

**Notifications & audit** — `Notification` is per-user, simple, and
read/unread; `AuditLog` is append-only and never updated, with a
polymorphic `(entityType, entityId)` pointer so any future entity can be
audited without a schema change.

**Settings** — a single `Setting` key/value (JSON) table backs the admin
Settings screen (business info, demo-data flag, order defaults) so
operational changes never require a code deploy or migration.

## Design conventions

- **Primary keys**: `cuid()` everywhere — sortable-enough, collision-
  resistant, and safe to expose in URLs.
- **Soft delete**: only on `Product` and `Customer` (`deletedAt`) — the
  two entities that are referenced by historical financial records
  (orders, ledger entries) and must never actually disappear once
  transacted against. Everything else uses `isActive` flags or hard
  delete where no financial history depends on it.
- **Timestamps**: `createdAt`/`updatedAt` on every mutable entity.
- **Indexes**: added on every foreign key used in a `WHERE`, every
  status/enum column filtered in list views, and (via the
  `add_trgm_search` migration) GIN trigram indexes for fuzzy search.
- **Decimal, not float**: every money field is `Decimal` — this is
  financial software; float rounding errors are not acceptable.

## Migrations

- `20260830143926_init` — the full initial schema.
- `20260830145059_add_trgm_search` — enables `pg_trgm` and adds GIN
  indexes for fuzzy product/company search.

Run `npm run db:migrate` in development (interactive) or
`npm run db:deploy` in CI/production (non-interactive, applies pending
migrations only).
