import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import { NotFoundError } from '@/lib/auth/rbac';
import { ExpenseError, getHighValueThreshold } from '@/lib/expenses';
import type { SettlementDirection } from '@prisma/client';

// --- Travel advances (§12) ---------------------------------------------------

export async function giveAdvance(params: { salesmanId: string; amount: number; purpose?: string; givenByUserId: string }) {
  if (params.amount <= 0) throw new ExpenseError('Advance amount must be greater than zero.');
  const salesman = await prisma.salesman.findUnique({ where: { id: params.salesmanId } });
  if (!salesman) throw new NotFoundError('Salesman not found.');

  const advance = await prisma.expenseAdvance.create({
    data: { salesmanId: params.salesmanId, amount: params.amount, purpose: params.purpose, givenByUserId: params.givenByUserId },
  });

  await writeAuditLog({
    actorUserId: params.givenByUserId,
    action: 'EXPENSE_ADVANCE_GIVEN',
    entityType: 'ExpenseAdvance',
    entityId: advance.id,
    metadata: { salesmanId: params.salesmanId, amount: params.amount },
  });

  await notifyUser(salesman.userId, {
    type: 'EXPENSE_ADVANCE_GIVEN',
    title: 'Travel advance received',
    body: `An advance of ₹${params.amount.toFixed(2)} has been recorded for you.`,
    linkUrl: '/sales/expenses/advance',
  });

  return advance;
}

export function listAdvances(salesmanId?: string) {
  return prisma.expenseAdvance.findMany({
    where: salesmanId ? { salesmanId } : {},
    include: { salesman: { select: { name: true } }, givenBy: { select: { name: true } } },
    orderBy: { givenAt: 'desc' },
  });
}

// --- Real-time outstanding balance (used by the admin control dashboard) ----

/**
 * Positive = the salesman is still holding unspent advance money.
 * Negative = approved expenses exceeded advances given — the company owes
 * the salesman a reimbursement. Only counts advances/expenses not yet
 * folded into a closed month-end settlement.
 */
export async function getOpenBalance(salesmanId: string): Promise<number> {
  const [advanceAgg, expenseAgg] = await Promise.all([
    prisma.expenseAdvance.aggregate({ where: { salesmanId, settlementId: null }, _sum: { amount: true } }),
    prisma.expense.aggregate({
      where: { salesmanId, settlementId: null, status: { in: ['APPROVED', 'REIMBURSED'] } },
      _sum: { amount: true },
    }),
  ]);
  return Number(advanceAgg._sum.amount ?? 0) - Number(expenseAgg._sum.amount ?? 0);
}

// --- Month-end settlement (§13) ----------------------------------------------

export interface SettlementFigures {
  openingAdvance: number;
  newAdvance: number;
  approvedExpenses: number;
  closingBalance: number;
  direction: SettlementDirection;
}

function directionOf(closingBalance: number): SettlementDirection {
  if (closingBalance > 0.005) return 'AMOUNT_TO_RETURN';
  if (closingBalance < -0.005) return 'AMOUNT_TO_REIMBURSE';
  return 'SETTLED';
}

/** Computes (without saving) what closing a settlement for this period would look like. */
export async function computeSettlementPreview(salesmanId: string, periodStart: Date, periodEnd: Date): Promise<SettlementFigures> {
  const priorSettlement = await prisma.expenseSettlement.findFirst({
    where: { salesmanId, periodEnd: { lt: periodStart } },
    orderBy: { periodEnd: 'desc' },
  });
  // Unspent advance carries forward; a reimbursement-due balance does not
  // (it is a payable that gets cleared by the company, not cash the
  // salesman is still holding).
  const openingAdvance = priorSettlement && priorSettlement.direction === 'AMOUNT_TO_RETURN' ? Number(priorSettlement.closingBalance) : 0;

  const [newAdvanceAgg, approvedExpenseAgg] = await Promise.all([
    prisma.expenseAdvance.aggregate({
      where: { salesmanId, settlementId: null, givenAt: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { salesmanId, settlementId: null, status: { in: ['APPROVED', 'REIMBURSED'] }, expenseDate: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    }),
  ]);

  const newAdvance = Number(newAdvanceAgg._sum.amount ?? 0);
  const approvedExpenses = Number(approvedExpenseAgg._sum.amount ?? 0);
  const closingBalance = openingAdvance + newAdvance - approvedExpenses;

  return { openingAdvance, newAdvance, approvedExpenses, closingBalance, direction: directionOf(closingBalance) };
}

/**
 * Closes a settlement: snapshots the figures, then folds every advance and
 * approved expense counted into it so they are never double-counted by a
 * later settlement. This is the only place expense/advance rows are
 * batch-updated after the fact — always for bookkeeping linkage, never to
 * change amounts or decisions (§22).
 */
export async function closeSettlement(params: {
  salesmanId: string;
  periodStart: Date;
  periodEnd: Date;
  settledByUserId: string;
  notes?: string;
}) {
  const existing = await prisma.expenseSettlement.findUnique({
    where: { salesmanId_periodStart_periodEnd: { salesmanId: params.salesmanId, periodStart: params.periodStart, periodEnd: params.periodEnd } },
  });
  if (existing) throw new ExpenseError('This period has already been settled for this salesman.');

  const figures = await computeSettlementPreview(params.salesmanId, params.periodStart, params.periodEnd);

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.expenseSettlement.create({
      data: {
        salesmanId: params.salesmanId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        openingAdvance: figures.openingAdvance,
        newAdvance: figures.newAdvance,
        approvedExpenses: figures.approvedExpenses,
        closingBalance: figures.closingBalance,
        direction: figures.direction,
        notes: params.notes,
        settledByUserId: params.settledByUserId,
      },
    });

    await tx.expenseAdvance.updateMany({
      where: { salesmanId: params.salesmanId, settlementId: null, givenAt: { gte: params.periodStart, lte: params.periodEnd } },
      data: { settlementId: created.id },
    });
    await tx.expense.updateMany({
      where: {
        salesmanId: params.salesmanId,
        settlementId: null,
        status: { in: ['APPROVED', 'REIMBURSED'] },
        expenseDate: { gte: params.periodStart, lte: params.periodEnd },
      },
      data: { settlementId: created.id },
    });

    return created;
  });

  await writeAuditLog({
    actorUserId: params.settledByUserId,
    action: 'EXPENSE_SETTLEMENT_CLOSED',
    entityType: 'ExpenseSettlement',
    entityId: settlement.id,
    metadata: { ...figures },
  });

  const salesman = await prisma.salesman.findUnique({ where: { id: params.salesmanId } });
  if (salesman) {
    const label =
      figures.direction === 'AMOUNT_TO_RETURN'
        ? `You need to return ₹${figures.closingBalance.toFixed(2)} of unused advance.`
        : figures.direction === 'AMOUNT_TO_REIMBURSE'
          ? `An additional ₹${Math.abs(figures.closingBalance).toFixed(2)} reimbursement is due to you.`
          : 'Your advance and expenses are fully settled.';
    await notifyUser(salesman.userId, {
      type: 'EXPENSE_SETTLEMENT_CLOSED',
      title: 'Expense settlement closed',
      body: label,
      linkUrl: '/sales/expenses/advance',
    });

    if (figures.direction === 'AMOUNT_TO_REIMBURSE' && Math.abs(figures.closingBalance) >= (await getHighValueThreshold())) {
      await notifyAdmins({
        type: 'LARGE_REIMBURSEMENT_REQUESTED',
        title: '⚠️ Large reimbursement due',
        body: `${salesman.name}'s settlement leaves a ₹${Math.abs(figures.closingBalance).toFixed(2)} reimbursement due.`,
        linkUrl: '/admin/expenses/settlements',
      });
    }
  }

  return settlement;
}

export function listSettlements(salesmanId?: string) {
  return prisma.expenseSettlement.findMany({
    where: salesmanId ? { salesmanId } : {},
    include: { salesman: { select: { name: true } }, settledBy: { select: { name: true } } },
    orderBy: { periodEnd: 'desc' },
  });
}
