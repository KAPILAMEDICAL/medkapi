# API Reference

All routes live under `src/app/api/**/route.ts`. Every response is JSON
shaped as `{ ok: true, data }` or `{ ok: false, error: string }`
(`src/lib/api-response.ts`) — errors never leak stack traces or internal
messages. Authentication is via the `kapila_session` httpOnly cookie set
on login; there is no separate API key/token flow for first-party clients.

## Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/otp/request` | none | Request an OTP for customer/sales login or registration mobile verification |
| POST | `/api/auth/otp/verify` | none | Verify OTP, create a session |
| POST | `/api/auth/admin/login` | none | Step 1 of admin login: password check, sends 2FA OTP |
| POST | `/api/auth/admin/otp-verify` | none | Step 2 of admin login: verify OTP, create session |
| POST | `/api/auth/logout` | any | Revoke the current session |
| GET | `/api/auth/session` | any | Bootstrap "who am I" for client components |

## Customers

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/customers/register` | none | Public self-registration (creates `PENDING_APPROVAL`) |
| GET | `/api/customers` | admin, sales | List customers (scoped: sales boy sees only their own, sales manager their team, admin all) |
| POST | `/api/customers` | admin | Admin-direct customer creation (pre-approved) |
| GET | `/api/customers/:id` | owner, assigned sales, admin | Customer detail |
| PATCH | `/api/customers/:id` | admin | Approve / disable / reject / reactivate / assign salesman / update price visibility |
| GET | `/api/customers/:id/ledger` | owner, assigned sales, admin | Account statement + outstanding balance |
| GET | `/api/customers/:id/ledger/export` | owner, assigned sales, admin | Downloadable CSV statement |

## Catalog

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/products` | any | Fuzzy/paginated search & filter (query, company, category, fastMoving, featured, new) |
| GET | `/api/products/:id` | any | Product detail + related products + active offers |
| POST | `/api/admin/products` | admin | Create product |
| GET/PATCH | `/api/admin/products/:id` | admin | Read / update product (price changes are audit-logged distinctly) |
| GET | `/api/companies` | any | Company directory (A–Z filter, search) |
| POST | `/api/companies` | admin | Create company |
| GET | `/api/companies/:id` | any | Company detail + its products |
| GET | `/api/offers` | any | Active offers visible to the caller's role |
| POST | `/api/offers` | admin | Create offer (notifies affected customers) |

## Orders & payments

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/orders` | any (scoped) | List orders (own / assigned / all, with status filter) |
| POST | `/api/orders` | customer, sales, admin | Book an order (server-priced, transactional) |
| GET | `/api/orders/:id` | owner, assigned sales, admin | Order detail |
| PATCH | `/api/orders/:id` | admin | Advance order status through the fulfillment workflow |
| GET | `/api/payments` | any (scoped) | List payments |
| POST | `/api/payments` | sales, admin | Record a payment (cash/UPI/bank/cheque) |
| PATCH | `/api/payments/:id` | admin | Verify / reject / mark cheque cleared or bounced |

## Expenses & expenditure management

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/expenses/ocr` | sales | Upload a bill photo; runs real OCR, returns editable extracted fields |
| GET | `/api/expenses` | sales (own), admin | List expenses — filter by status/salesman/category/vendor/month/amount/duplicates |
| POST | `/api/expenses` | sales | Submit an expense (bill photo or manual, with confirmed fields + optional GPS) |
| GET | `/api/expenses/:id` | owner, admin | Expense detail |
| PATCH | `/api/expenses/:id` | admin | Approve / reject / request correction; `{action:"REIMBURSE"}`; `{action:"REOPEN", reason}` (super admin) |
| PUT | `/api/expenses/:id` | owner (sales) | Edit a not-yet-approved expense, or resubmit after a requested correction |
| GET | `/api/expenses/summary` | sales | "My Expenditure" dashboard numbers (today/week/month, status totals, limit) |
| GET/POST | `/api/expenses/categories` | any / admin | List active categories; admin adds a new one |
| PATCH | `/api/expenses/categories/:id` | admin | Rename, reorder, activate/deactivate a category |
| GET | `/api/expenses/policy` | any | Company policy the entry form needs (e.g. bill-required-above amount) |
| GET/POST | `/api/expenses/advances` | sales (own) / admin | List travel advances; admin gives a new one |
| GET/POST | `/api/expenses/settlements` | sales (own) / admin | Settlement history + live preview; admin closes a period |
| GET | `/api/admin/expenditure/summary` | admin | Team KPIs, category/day/salesman/month breakdowns, sales-vs-collection-vs-expense |
| GET | `/api/expenses/export` | admin | CSV export — `report=daily\|salesman\|monthly\|category\|approved\|pending\|reimbursement\|advance-settlement` |

## Tours & visits

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/tours` | sales (own), admin | Get a salesman's tour for a date, enriched with per-stop customer context |
| POST | `/api/tours` | admin | Create/replace a salesman's tour schedule for a date |
| POST | `/api/visits` | sales | Start a visit (location only with explicit consent) |
| PATCH | `/api/visits/:id` | sales (own) | Finish/skip a visit |

## Sales team, notifications, settings

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/salesmen` | admin | List sales team with performance rollups |
| POST | `/api/salesmen` | admin | Create a salesman |
| PATCH | `/api/salesmen/:id` | admin | Update territory/targets/manager/active state |
| GET | `/api/notifications` | any | List + unread count |
| PATCH | `/api/notifications` | any | Mark one or all as read |
| GET | `/api/settings` | admin | Read all settings |
| PATCH | `/api/settings` | super admin | Update a setting |

## Dashboards

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/dashboard/customer` | customer | Outstanding, recent orders, offer/new-product counts |
| GET | `/api/dashboard/sales` | sales | Today/month sales & collection vs. target, visit counts |
| GET | `/api/dashboard/admin` | admin | KPIs + "what needs attention today" priorities |

## Uploads

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/uploads?category=` | any (category-gated) | Generic file upload (bills/cheques/receipts for anyone; product/offer/logo images admin-only) — validates real file signature server-side, never trusts the client's claimed MIME type |
