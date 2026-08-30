import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
} from 'date-fns';
import { Prisma, type ExpenseStatus, type PaymentMode } from '@prisma/client';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import { NotFoundError } from '@/lib/auth/rbac';

export class ExpenseError extends Error {}

const DEFAULT_MONTHLY_LIMIT = 25_000;
const DEFAULT_HIGH_VALUE_THRESHOLD = 5_000;
const DEFAULT_REVIEW_THRESHOLD_PERCENT = 3;

// --- Admin-tunable settings (Master Prompt §8) ------------------------------
// Stored in the generic Setting table so limits can be changed without a
// code deploy, same pattern as business.info / seed.isDemoData.

export async function getMonthlyLimitFor(salesmanId: string): Promise<number> {
  const salesman = await prisma.salesman.findUnique({ where: { id: salesmanId }, select: { monthlyExpenseLimit: true } });
  if (salesman?.monthlyExpenseLimit != null) return Number(salesman.monthlyExpenseLimit);
  const setting = await prisma.setting.findUnique({ where: { key: 'expense.monthlyLimitDefault' } });
  return typeof setting?.valueJson === 'number' ? setting.valueJson : DEFAULT_MONTHLY_LIMIT;
}

export async function getHighValueThreshold(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: 'expense.highValueThreshold' } });
  return typeof setting?.valueJson === 'number' ? setting.valueJson : DEFAULT_HIGH_VALUE_THRESHOLD;
}

export async function getReviewThresholdPercent(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: 'expense.reviewThresholdPercent' } });
  return typeof setting?.valueJson === 'number' ? setting.valueJson : DEFAULT_REVIEW_THRESHOLD_PERCENT;
}

const DEFAULT_BILL_REQUIRED_ABOVE = 500;

/** §4: "Bill attachment should be optional only where company policy allows it." */
export async function getBillRequiredAboveAmount(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: 'expense.billRequiredAboveAmount' } });
  return typeof setting?.valueJson === 'number' ? setting.valueJson : DEFAULT_BILL_REQUIRED_ABOVE;
}

// Statuses that count as "still money the company is on the hook for" when
// checking a limit — a REJECTED expense never counts against it.
const LIMIT_COUNTING_STATUSES: ExpenseStatus[] = ['PENDING', 'CORRECTION_REQUESTED', 'APPROVED', 'REIMBURSED'];

// --- Duplicate-bill protection (§16) ----------------------------------------

/**
 * Looks for another (non-rejected) expense from the same salesman that
 * matches on bill number, or on vendor + amount + date, within a same-day
 * window. Never blocks submission — only flags it for admin review.
 */
export async function findPossibleDuplicate(params: {
  salesmanId: string;
  billNumber?: string;
  merchant?: string;
  amount: number;
  expenseDate: Date;
  excludeExpenseId?: string;
}) {
  const dayStart = startOfDay(params.expenseDate);
  const dayEnd = endOfDay(params.expenseDate);

  const or: Prisma.ExpenseWhereInput[] = [];
  if (params.billNumber?.trim()) {
    or.push({ billNumber: { equals: params.billNumber.trim(), mode: 'insensitive' } });
  }
  if (params.merchant?.trim()) {
    or.push({
      merchant: { equals: params.merchant.trim(), mode: 'insensitive' },
      amount: params.amount,
      expenseDate: { gte: dayStart, lte: dayEnd },
    });
  }
  if (or.length === 0) return null;

  return prisma.expense.findFirst({
    where: {
      salesmanId: params.salesmanId,
      status: { not: 'REJECTED' },
      ...(params.excludeExpenseId ? { id: { not: params.excludeExpenseId } } : {}),
      OR: or,
    },
    orderBy: { submittedAt: 'asc' },
  });
}

// --- Create / edit -----------------------------------------------------------

export interface CreateExpenseInput {
  salesmanId: string;
  categoryId: string;
  amount: number;
  gstAmount?: number;
  expenseDate: Date;
  merchant?: string;
  billNumber?: string;
  paymentMode?: PaymentMode;
  description?: string;
  remarks?: string;
  billImageUrl?: string;
  ocrRawText?: string;
  ocrConfidence?: number;
  ocrProvider?: string;
  location?: { latitude: number; longitude: number; accuracy?: number };
}

/**
 * Creates a submitted expense — from either the "Upload Bill" (OCR-assisted)
 * or "Enter Manually" flow. OCR fields, when present, are stored purely as
 * a record of what was auto-extracted: the amount/category/date actually
 * saved always come from what the salesman confirmed on screen, never
 * blindly from OCR output (§3). GPS is stored only when the caller passed
 * `location`, i.e. only after the browser/device granted permission (§10).
 */
export async function createExpense(input: CreateExpenseInput) {
  const category = await prisma.expenseCategoryConfig.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) throw new ExpenseError('Please choose a valid expense category.');

  const duplicate = await findPossibleDuplicate({
    salesmanId: input.salesmanId,
    billNumber: input.billNumber,
    merchant: input.merchant,
    amount: input.amount,
    expenseDate: input.expenseDate,
  });

  const expense = await prisma.expense.create({
    data: {
      salesmanId: input.salesmanId,
      categoryId: input.categoryId,
      amount: input.amount,
      gstAmount: input.gstAmount,
      expenseDate: input.expenseDate,
      merchant: input.merchant,
      billNumber: input.billNumber,
      paymentMode: input.paymentMode ?? 'CASH',
      description: input.description,
      remarks: input.remarks,
      billImageUrl: input.billImageUrl,
      ocrRawText: input.ocrRawText,
      ocrConfidence: input.ocrConfidence,
      ocrProvider: input.ocrProvider,
      latitude: input.location?.latitude,
      longitude: input.location?.longitude,
      locationAccuracy: input.location?.accuracy,
      locationCapturedAt: input.location ? new Date() : undefined,
      isPossibleDuplicate: !!duplicate,
      duplicateOfExpenseId: duplicate?.id,
      status: 'PENDING',
    },
    include: { salesman: { include: { user: true } }, category: true },
  });

  await writeAuditLog({
    actorUserId: expense.salesman.userId,
    action: 'EXPENSE_SUBMITTED',
    entityType: 'Expense',
    entityId: expense.id,
    metadata: { category: category.name, amount: input.amount, isPossibleDuplicate: !!duplicate },
  });

  await notifyAdmins({
    type: 'EXPENSE_SUBMITTED',
    title: 'Expense awaiting approval',
    body: `${expense.salesman.name} submitted a ₹${input.amount.toFixed(2)} ${category.name} expense.`,
    linkUrl: `/admin/expenses/${expense.id}`,
  });

  const [highValueThreshold, monthlyLimit, monthUsed] = await Promise.all([
    getHighValueThreshold(),
    getMonthlyLimitFor(input.salesmanId),
    sumExpensesForSalesman(input.salesmanId, startOfMonth(input.expenseDate), endOfMonth(input.expenseDate), LIMIT_COUNTING_STATUSES),
  ]);

  if (input.amount >= highValueThreshold) {
    await notifyAdmins({
      type: 'EXPENSE_HIGH_VALUE',
      title: 'High-value expense submitted',
      body: `${expense.salesman.name} submitted a high-value expense of ₹${input.amount.toFixed(2)} (${category.name}).`,
      linkUrl: `/admin/expenses/${expense.id}`,
    });
  }

  if (monthUsed > monthlyLimit) {
    await notifyAdmins({
      type: 'EXPENSE_LIMIT_EXCEEDED',
      title: '⚠️ Expense limit exceeded',
      body: `${expense.salesman.name} has used ₹${monthUsed.toFixed(2)} against a ₹${monthlyLimit.toFixed(2)} monthly limit.`,
      linkUrl: `/admin/expenses?salesmanId=${input.salesmanId}`,
    });
  }

  if (duplicate) {
    await notifyAdmins({
      type: 'EXPENSE_DUPLICATE_SUSPECTED',
      title: '⚠️ Possible duplicate bill',
      body: `${expense.salesman.name}'s new expense looks like a duplicate of an earlier ₹${Number(duplicate.amount).toFixed(2)} submission.`,
      linkUrl: `/admin/expenses/${expense.id}`,
    });
  }

  return expense;
}

export interface UpdateExpenseInput {
  expenseId: string;
  actorUserId: string;
  categoryId?: string;
  amount?: number;
  gstAmount?: number;
  expenseDate?: Date;
  merchant?: string;
  billNumber?: string;
  paymentMode?: PaymentMode;
  description?: string;
  remarks?: string;
  billImageUrl?: string;
}

/**
 * Edits a not-yet-approved expense — used for the salesman's own
 * pre-submission corrections and for resubmitting after an admin's
 * REQUEST CORRECTION. §22: approved/reimbursed records are locked and
 * cannot go through this path; every accepted edit is written to the
 * immutable audit log with a before/after diff.
 */
export async function updateExpense(input: UpdateExpenseInput) {
  const existing = await prisma.expense.findUnique({ where: { id: input.expenseId } });
  if (!existing) throw new NotFoundError('Expense not found.');
  if (existing.isLocked || existing.status === 'APPROVED' || existing.status === 'REIMBURSED') {
    throw new ExpenseError('This expense has been approved and is locked. Ask an admin to reopen it first.');
  }
  if (existing.status === 'REJECTED') {
    throw new ExpenseError('This expense was rejected. Please submit a new expense instead of editing it.');
  }

  const wasCorrectionRequest = existing.status === 'CORRECTION_REQUESTED';
  const duplicate = await findPossibleDuplicate({
    salesmanId: existing.salesmanId,
    billNumber: input.billNumber ?? existing.billNumber ?? undefined,
    merchant: input.merchant ?? existing.merchant ?? undefined,
    amount: input.amount ?? Number(existing.amount),
    expenseDate: input.expenseDate ?? existing.expenseDate,
    excludeExpenseId: existing.id,
  });

  const updated = await prisma.expense.update({
    where: { id: input.expenseId },
    data: {
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.gstAmount !== undefined ? { gstAmount: input.gstAmount } : {}),
      ...(input.expenseDate !== undefined ? { expenseDate: input.expenseDate } : {}),
      ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
      ...(input.billNumber !== undefined ? { billNumber: input.billNumber } : {}),
      ...(input.paymentMode !== undefined ? { paymentMode: input.paymentMode } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
      ...(input.billImageUrl !== undefined ? { billImageUrl: input.billImageUrl } : {}),
      isPossibleDuplicate: !!duplicate,
      duplicateOfExpenseId: duplicate?.id ?? null,
      editedAt: new Date(),
      editedByUserId: input.actorUserId,
      // A resubmitted correction goes back to PENDING for a fresh review.
      ...(wasCorrectionRequest ? { status: 'PENDING' as const, reviewedByUserId: null, reviewedAt: null } : {}),
    },
  });

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: wasCorrectionRequest ? 'EXPENSE_CORRECTED_AND_RESUBMITTED' : 'EXPENSE_EDITED',
    entityType: 'Expense',
    entityId: updated.id,
    metadata: { before: serializeForAudit(existing), after: serializeForAudit(updated) },
  });

  if (wasCorrectionRequest) {
    await notifyAdmins({
      type: 'EXPENSE_RESUBMITTED',
      title: 'Corrected expense resubmitted',
      body: `An expense you requested correction on has been resubmitted for review.`,
      linkUrl: `/admin/expenses/${updated.id}`,
    });
  }

  return updated;
}

function serializeForAudit(e: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(e, (_k, v) => (v instanceof Prisma.Decimal ? v.toString() : v)));
}

// --- Approval workflow (§9) --------------------------------------------------

export async function reviewExpense(params: {
  expenseId: string;
  reviewedByUserId: string;
  decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED';
  adminRemarks?: string;
}) {
  const existing = await prisma.expense.findUnique({ where: { id: params.expenseId }, include: { salesman: true } });
  if (!existing) throw new NotFoundError('Expense not found.');
  if (existing.isLocked) throw new ExpenseError('This expense is locked and has already been decided.');
  if (params.decision === 'CORRECTION_REQUESTED' && !params.adminRemarks?.trim()) {
    throw new ExpenseError('Please explain what needs to be corrected.');
  }

  const expense = await prisma.expense.update({
    where: { id: params.expenseId },
    data: {
      status: params.decision,
      reviewedByUserId: params.reviewedByUserId,
      reviewedAt: new Date(),
      adminRemarks: params.adminRemarks,
      isLocked: params.decision === 'APPROVED',
    },
    include: { salesman: { include: { user: true } }, category: true },
  });

  await writeAuditLog({
    actorUserId: params.reviewedByUserId,
    action: `EXPENSE_${params.decision}`,
    entityType: 'Expense',
    entityId: expense.id,
    metadata: { adminRemarks: params.adminRemarks },
  });

  const messages: Record<typeof params.decision, string> = {
    APPROVED: `Your ₹${Number(expense.amount).toFixed(2)} ${expense.category.name} expense was approved.`,
    REJECTED: `Your ₹${Number(expense.amount).toFixed(2)} ${expense.category.name} expense was rejected.${params.adminRemarks ? ` Reason: ${params.adminRemarks}` : ''}`,
    CORRECTION_REQUESTED: `Please correct and resubmit your ₹${Number(expense.amount).toFixed(2)} ${expense.category.name} expense. ${params.adminRemarks}`,
  };
  await notifyUser(expense.salesman.userId, {
    type: `EXPENSE_${params.decision}`,
    title: 'Expense update',
    body: messages[params.decision],
    linkUrl: `/sales/expenses/${expense.id}`,
  });

  return expense;
}

/** Marks an already-approved expense as reimbursed (money actually paid out). */
export async function reimburseExpense(params: { expenseId: string; actorUserId: string }) {
  const existing = await prisma.expense.findUnique({ where: { id: params.expenseId }, include: { salesman: true, category: true } });
  if (!existing) throw new NotFoundError('Expense not found.');
  if (existing.status !== 'APPROVED') throw new ExpenseError('Only an approved expense can be marked reimbursed.');

  const expense = await prisma.expense.update({
    where: { id: params.expenseId },
    data: { status: 'REIMBURSED', reimbursedAt: new Date() },
  });

  await writeAuditLog({ actorUserId: params.actorUserId, action: 'EXPENSE_REIMBURSED', entityType: 'Expense', entityId: expense.id });
  await notifyUser(existing.salesman.userId, {
    type: 'EXPENSE_REIMBURSED',
    title: 'Expense reimbursed',
    body: `Your ₹${Number(existing.amount).toFixed(2)} ${existing.category.name} expense has been reimbursed.`,
    linkUrl: `/sales/expenses/${expense.id}`,
  });
  return expense;
}

/**
 * §22: "Approved financial records should be locked unless an authorized
 * admin reopens them." Reopening does not itself change the decision —
 * a follow-up reviewExpense() call is still required — it only lifts the
 * lock, and is itself fully audited.
 */
export async function reopenExpense(params: { expenseId: string; actorUserId: string; reason: string }) {
  if (!params.reason?.trim()) throw new ExpenseError('Please state why this record is being reopened.');
  const existing = await prisma.expense.findUnique({ where: { id: params.expenseId } });
  if (!existing) throw new NotFoundError('Expense not found.');
  if (!existing.isLocked) throw new ExpenseError('This expense is not locked.');

  const expense = await prisma.expense.update({
    where: { id: params.expenseId },
    data: { isLocked: false, reopenedByUserId: params.actorUserId, reopenedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: params.actorUserId,
    action: 'EXPENSE_REOPENED',
    entityType: 'Expense',
    entityId: expense.id,
    metadata: { reason: params.reason },
  });
  return expense;
}

// --- Aggregation helpers ------------------------------------------------------

async function sumExpensesForSalesman(salesmanId: string, from: Date, to: Date, statuses?: ExpenseStatus[]) {
  const agg = await prisma.expense.aggregate({
    where: { salesmanId, expenseDate: { gte: from, lte: to }, ...(statuses ? { status: { in: statuses } } : {}) },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

/** Powers the "💳 MY EXPENDITURE" sales-boy dashboard (§1/§6/§8). */
export async function getSalesmanExpenditureSummary(salesmanId: string, at: Date = new Date()) {
  const today = { from: startOfDay(at), to: endOfDay(at) };
  const week = { from: startOfWeek(at, { weekStartsOn: 1 }), to: endOfWeek(at, { weekStartsOn: 1 }) };
  const month = { from: startOfMonth(at), to: endOfMonth(at) };

  const [todayTotal, weekTotal, monthTotal, monthApproved, monthPending, monthRejected, monthReimbursed, monthlyLimit, categoryRows] =
    await Promise.all([
      sumExpensesForSalesman(salesmanId, today.from, today.to),
      sumExpensesForSalesman(salesmanId, week.from, week.to),
      sumExpensesForSalesman(salesmanId, month.from, month.to),
      sumExpensesForSalesman(salesmanId, month.from, month.to, ['APPROVED']),
      sumExpensesForSalesman(salesmanId, month.from, month.to, ['PENDING', 'CORRECTION_REQUESTED']),
      sumExpensesForSalesman(salesmanId, month.from, month.to, ['REJECTED']),
      sumExpensesForSalesman(salesmanId, month.from, month.to, ['REIMBURSED']),
      getMonthlyLimitFor(salesmanId),
      prisma.expense.groupBy({
        by: ['categoryId'],
        where: { salesmanId, expenseDate: { gte: month.from, lte: month.to } },
        _sum: { amount: true },
      }),
    ]);

  const categories = await prisma.expenseCategoryConfig.findMany({ where: { id: { in: categoryRows.map((r) => r.categoryId) } } });
  const categoryBreakdown = categoryRows
    .map((r) => ({
      categoryId: r.categoryId,
      categoryName: categories.find((c) => c.id === r.categoryId)?.name ?? 'Other',
      total: Number(r._sum.amount ?? 0),
    }))
    .sort((a, b) => b.total - a.total);

  const used = monthApproved + monthPending + monthReimbursed; // rejected never counts against the limit
  const remaining = Math.max(0, monthlyLimit - used);

  return {
    today: todayTotal,
    week: weekTotal,
    month: monthTotal,
    approved: monthApproved,
    pending: monthPending,
    rejected: monthRejected,
    reimbursed: monthReimbursed,
    categoryBreakdown,
    limit: { monthlyLimit, used, remaining, exceeded: used > monthlyLimit },
  };
}
