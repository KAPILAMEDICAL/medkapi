# Deployment

## Option A: Docker Compose (simplest)

```bash
cp .env.example .env
# Edit .env: set a real AUTH_SECRET (openssl rand -base64 48),
# SUPER_ADMIN_MOBILE, SUPER_ADMIN_PASSWORD, and — before go-live —
# SMS_PROVIDER / STORAGE_PROVIDER credentials for real providers.

docker compose up -d --build
docker compose exec app npm run db:deploy          # apply migrations
docker compose exec app npm run db:seed:production  # bootstrap Super Admin only
```

The app is then reachable on `http://localhost:3000` (put a reverse
proxy with TLS — nginx, Caddy, or your platform's load balancer — in
front of it for real traffic; Compose here does not terminate HTTPS).

## Option B: Build the image yourself

```bash
docker build -t kapila-medical .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@your-db-host:5432/kapila_medical \
  -e AUTH_SECRET=... \
  -e SUPER_ADMIN_MOBILE=... -e SUPER_ADMIN_PASSWORD=... \
  kapila-medical
```

The image uses Next.js's `standalone` output (see `next.config.js`) —
`.next/standalone` is a minimal, self-contained Node server with only
the runtime dependencies it actually needs (verified in this repo: both
`tesseract.js`'s worker/wasm files and the generated `@prisma/client`
engine are correctly traced into the standalone bundle).

## Environment variables

See `.env.example` for the full, commented list. The ones that matter
most for a production go-live:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Must point at a PostgreSQL instance with the `pg_trgm` extension installable (available by default on RDS/Cloud SQL/most managed Postgres). |
| `AUTH_SECRET` | Generate with `openssl rand -base64 48`. Rotating it invalidates all sessions. |
| `SUPER_ADMIN_MOBILE` / `SUPER_ADMIN_PASSWORD` | Only used by `db:seed:production`. Change the password immediately after first login. |
| `SMS_PROVIDER` | Must be a real gateway before go-live — `console`/`test-file` only print OTPs to logs/a local file. |
| `STORAGE_PROVIDER` | Set to `s3` for anything beyond a single-instance evaluation deployment — local disk uploads do not survive redeploys or scale past one instance. |
| `OCR_PROVIDER` | `tesseract` works out of the box with no account; switch to a cloud OCR provider only if bill-reading accuracy needs to improve at scale. |

## Database migrations in production

```bash
npm run db:deploy     # prisma migrate deploy — non-interactive, applies pending migrations only
```

Never run `prisma migrate dev` against a production database — it can
prompt interactively and is meant for local schema iteration.

## Importing real data

Once real Kapila Medical Agencies company/product/customer data is
available (from the business's existing records or an Excel export),
the fastest path in this version of the app is the admin API:

- `POST /api/companies`, `POST /api/admin/products` — one call per
  record, or scripted in a loop from a parsed spreadsheet.
- `POST /api/customers` — for pre-approved onboarding of existing
  customers.

A dedicated Excel upload → preview → validate → confirm UI (Master
Prompt §26/§54) is designed for but not yet built in this version — see
`docs/DATABASE_SCHEMA.md` for the exact fields each import target needs,
which is the same shape the admin CRUD forms already use.

Once real data is loaded, turn off the demo-data notice from
`/admin/settings` ("Demo Data" card) — this flips the `seed.isDemoData`
setting that the customer/sales/admin portals check to show the
"DEMO DATA" banner.

## Health & readiness

- `GET /` returns 200 once the app is up; there is no separate
  `/healthz` endpoint in this version — add one if your orchestrator
  requires it (a one-line route handler that queries `SELECT 1`).
- The Docker Compose `db` service has a `pg_isready` healthcheck the
  `app` service depends on, so `app` won't start before Postgres is
  actually accepting connections.

## Rollback

Because migrations are additive and versioned in `prisma/migrations`,
rolling back the application image to a previous version is safe as
long as no migration from a newer version has been applied to the
database it's pointed at. Keep migrations and application releases
paired (tag the migration state alongside the image tag) if you need to
roll back both together.
