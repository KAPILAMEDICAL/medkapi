-- Expenditure Management System (sales-boy expense/advance/settlement module).
--
-- This migration is written to be safe against a previously-seeded dev
-- database (not just a fresh one): the ExpenseStatus enum swap remaps old
-- values instead of assuming zero rows, and the new NOT NULL
-- Expense.categoryId is backfilled from the legacy category enum before
-- the constraint is enforced. Note: `Product_*_trgm_idx` / `Company_name_trgm_idx`
-- GIN indexes from the previous migration are hand-written raw SQL with no
-- Prisma-schema representation — they are intentionally left untouched here.

-- CreateEnum
CREATE TYPE "SettlementDirection" AS ENUM ('AMOUNT_TO_RETURN', 'AMOUNT_TO_REIMBURSE', 'SETTLED');

-- AlterEnum: ExpenseStatus is redefined to the §9 approval vocabulary
-- (Pending / Correction Requested / Approved / Rejected / Reimbursed).
ALTER TABLE "Expense" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Expense" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
UPDATE "Expense" SET "status" = CASE "status"
  WHEN 'DRAFT' THEN 'PENDING'
  WHEN 'SUBMITTED' THEN 'PENDING'
  WHEN 'UNDER_REVIEW' THEN 'PENDING'
  WHEN 'PAID' THEN 'REIMBURSED'
  ELSE "status"
END;
DROP TYPE "ExpenseStatus";
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'CORRECTION_REQUESTED', 'APPROVED', 'REJECTED', 'REIMBURSED');
ALTER TABLE "Expense" ALTER COLUMN "status" TYPE "ExpenseStatus" USING "status"::"ExpenseStatus";
ALTER TABLE "Expense" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable: per-salesman expense limit override (falls back to the
-- global `expense.monthlyLimitDefault` Setting when null)
ALTER TABLE "Salesman" ADD COLUMN "monthlyExpenseLimit" DECIMAL(12,2);

-- CreateTable: admin-configurable expense categories (§5)
CREATE TABLE "ExpenseCategoryConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategoryConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExpenseCategoryConfig_name_key" ON "ExpenseCategoryConfig"("name");
CREATE UNIQUE INDEX "ExpenseCategoryConfig_code_key" ON "ExpenseCategoryConfig"("code");
CREATE INDEX "ExpenseCategoryConfig_isActive_sortOrder_idx" ON "ExpenseCategoryConfig"("isActive", "sortOrder");

-- Seed the 15 default categories from the Master Prompt (§5). Admins can
-- rename/add/deactivate afterward via /admin/expenses/categories.
INSERT INTO "ExpenseCategoryConfig" ("id", "name", "code", "sortOrder", "updatedAt") VALUES
  ('excat_fuel',                'Fuel',                 'FUEL',                 1, CURRENT_TIMESTAMP),
  ('excat_bus',                 'Bus',                  'BUS',                  2, CURRENT_TIMESTAMP),
  ('excat_train',               'Train',                'TRAIN',                3, CURRENT_TIMESTAMP),
  ('excat_auto',                'Auto',                 'AUTO',                 4, CURRENT_TIMESTAMP),
  ('excat_taxi',                'Taxi',                 'TAXI',                 5, CURRENT_TIMESTAMP),
  ('excat_hotel',                'Hotel',                'HOTEL',                6, CURRENT_TIMESTAMP),
  ('excat_food',                'Food',                 'FOOD',                 7, CURRENT_TIMESTAMP),
  ('excat_parking',             'Parking',              'PARKING',              8, CURRENT_TIMESTAMP),
  ('excat_toll',                'Toll',                 'TOLL',                 9, CURRENT_TIMESTAMP),
  ('excat_courier',             'Courier',              'COURIER',             10, CURRENT_TIMESTAMP),
  ('excat_stationery',          'Stationery',           'STATIONERY',          11, CURRENT_TIMESTAMP),
  ('excat_customer_meeting',    'Customer Meeting',     'CUSTOMER_MEETING',    12, CURRENT_TIMESTAMP),
  ('excat_vehicle_maintenance', 'Vehicle Maintenance',  'VEHICLE_MAINTENANCE', 13, CURRENT_TIMESTAMP),
  ('excat_mobile_internet',     'Mobile/Internet',      'MOBILE_INTERNET',     14, CURRENT_TIMESTAMP),
  ('excat_other',               'Other',                'OTHER',               15, CURRENT_TIMESTAMP);

-- CreateTable: month-end advance-vs-expense settlement (§13)
CREATE TABLE "ExpenseSettlement" (
    "id" TEXT NOT NULL,
    "salesmanId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "openingAdvance" DECIMAL(12,2) NOT NULL,
    "newAdvance" DECIMAL(12,2) NOT NULL,
    "approvedExpenses" DECIMAL(12,2) NOT NULL,
    "closingBalance" DECIMAL(12,2) NOT NULL,
    "direction" "SettlementDirection" NOT NULL,
    "notes" TEXT,
    "settledByUserId" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseSettlement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExpenseSettlement_salesmanId_idx" ON "ExpenseSettlement"("salesmanId");
CREATE UNIQUE INDEX "ExpenseSettlement_salesmanId_periodStart_periodEnd_key" ON "ExpenseSettlement"("salesmanId", "periodStart", "periodEnd");
ALTER TABLE "ExpenseSettlement" ADD CONSTRAINT "ExpenseSettlement_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "Salesman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseSettlement" ADD CONSTRAINT "ExpenseSettlement_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: cash advances given to a salesman for field travel (§12)
CREATE TABLE "ExpenseAdvance" (
    "id" TEXT NOT NULL,
    "salesmanId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "purpose" TEXT,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "givenByUserId" TEXT NOT NULL,
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseAdvance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExpenseAdvance_salesmanId_idx" ON "ExpenseAdvance"("salesmanId");
CREATE INDEX "ExpenseAdvance_settlementId_idx" ON "ExpenseAdvance"("settlementId");
ALTER TABLE "ExpenseAdvance" ADD CONSTRAINT "ExpenseAdvance_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "Salesman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseAdvance" ADD CONSTRAINT "ExpenseAdvance_givenByUserId_fkey" FOREIGN KEY ("givenByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseAdvance" ADD CONSTRAINT "ExpenseAdvance_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "ExpenseSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Expense — bill/manual entry fields, GPS, duplicate flag, lock/reopen, settlement link
ALTER TABLE "Expense"
  ADD COLUMN "adminRemarks" TEXT,
  ADD COLUMN "billNumber" TEXT,
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "duplicateOfExpenseId" TEXT,
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "editedByUserId" TEXT,
  ADD COLUMN "gstAmount" DECIMAL(10,2),
  ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isPossibleDuplicate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "latitude" DECIMAL(9,6),
  ADD COLUMN "locationAccuracy" DECIMAL(8,2),
  ADD COLUMN "locationCapturedAt" TIMESTAMP(3),
  ADD COLUMN "longitude" DECIMAL(9,6),
  ADD COLUMN "paymentMode" "PaymentMode" NOT NULL DEFAULT 'CASH',
  ADD COLUMN "reimbursedAt" TIMESTAMP(3),
  ADD COLUMN "remarks" TEXT,
  ADD COLUMN "reopenedAt" TIMESTAMP(3),
  ADD COLUMN "reopenedByUserId" TEXT,
  ADD COLUMN "settlementId" TEXT;

-- Backfill categoryId from the legacy category enum onto the seeded
-- defaults above, then enforce NOT NULL and drop the old column/enum.
UPDATE "Expense" SET "categoryId" = CASE "category"
  WHEN 'PETROL' THEN 'excat_fuel'
  WHEN 'TRAVEL' THEN 'excat_bus'
  WHEN 'FOOD' THEN 'excat_food'
  WHEN 'ACCOMMODATION' THEN 'excat_hotel'
  WHEN 'AUTO_TAXI' THEN 'excat_taxi'
  WHEN 'PARKING' THEN 'excat_parking'
  WHEN 'COURIER' THEN 'excat_courier'
  WHEN 'BUSINESS' THEN 'excat_customer_meeting'
  ELSE 'excat_other'
END
WHERE "categoryId" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Expense" DROP COLUMN "category";
ALTER TABLE "Expense" DROP COLUMN "rejectionReason";
DROP TYPE "ExpenseCategory";

CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_billNumber_idx" ON "Expense"("billNumber");
CREATE INDEX "Expense_settlementId_idx" ON "Expense"("settlementId");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategoryConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_duplicateOfExpenseId_fkey" FOREIGN KEY ("duplicateOfExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "ExpenseSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: User back-relations need no columns (relation is inverse-only)
