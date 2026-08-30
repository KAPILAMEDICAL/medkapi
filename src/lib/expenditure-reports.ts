import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { prisma } from '@/lib/db';
import { getOpenBalance } from '@/lib/expense-advances';
import { getReviewThresholdPercent } from '@/lib/expenses';
import type { ExpenseStatus } from '@prisma/client';

const NON_REJECTED: ExpenseStatus[] = ['PENDING', 'CORRECTION_REQUESTED', 'APPROVED', 'REIMBURSED'];

/**
 * Admin Expenditure Control dashboard (§14) — everything needed to answer
 * "how much did each sales boy spend, how much is pending/approved, and
 * who has the highest expense-to-sales ratio" at a glance.
 */
export async function getAdminExpenditureSummary(at: Date = new Date()) {
  const month = { from: startOfMonth(at), to: endOfMonth(at) };

  const [totalTeamAgg, pendingAgg, approvedAgg, salesmen] = await Promise.all([
    prisma.expense.aggregate({ where: { expenseDate: { gte: month.from, lte: month.to } }, _sum: { amount: true } }),
    prisma.expense.aggregate({
      where: { expenseDate: { gte: month.from, lte: month.to }, status: { in: ['PENDING', 'CORRECTION_REQUESTED'] } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { expenseDate: { gte: month.from, lte: month.to }, status: { in: ['APPROVED', 'REIMBURSED'] } },
      _sum: { amount: true },
    }),
    prisma.salesman.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
  ]);

  const reviewThreshold = await getReviewThresholdPercent();

  let advanceOutstanding = 0;
  let reimbursementDue = 0;
  const salesmanWise = await Promise.all(
    salesmen.map(async (s) => {
      const [salesAgg, collectionAgg, expenseAgg, openBalance] = await Promise.all([
        prisma.order.aggregate({ where: { salesmanId: s.id, bookedAt: { gte: month.from, lte: month.to } }, _sum: { grandTotal: true } }),
        prisma.payment.aggregate({ where: { salesmanId: s.id, paidAt: { gte: month.from, lte: month.to } }, _sum: { amount: true } }),
        prisma.expense.aggregate({
          where: { salesmanId: s.id, expenseDate: { gte: month.from, lte: month.to }, status: { in: ['APPROVED', 'REIMBURSED'] } },
          _sum: { amount: true },
        }),
        getOpenBalance(s.id),
      ]);

      if (openBalance > 0) advanceOutstanding += openBalance;
      else reimbursementDue += Math.abs(openBalance);

      const sales = Number(salesAgg._sum.grandTotal ?? 0);
      const collection = Number(collectionAgg._sum.amount ?? 0);
      const expense = Number(expenseAgg._sum.amount ?? 0);
      const expensePercent = sales > 0 ? (expense / sales) * 100 : expense > 0 ? 100 : 0;

      return {
        salesmanId: s.id,
        name: s.name,
        sales,
        collection,
        expense,
        expensePercent,
        status: expensePercent > reviewThreshold ? ('REVIEW' as const) : ('GOOD' as const),
      };
    }),
  );

  salesmanWise.sort((a, b) => b.expense - a.expense);

  return {
    totalTeamExpense: Number(totalTeamAgg._sum.amount ?? 0),
    pendingApproval: Number(pendingAgg._sum.amount ?? 0),
    approved: Number(approvedAgg._sum.amount ?? 0),
    reimbursementDue,
    advanceOutstanding,
    reviewThresholdPercent: reviewThreshold,
    salesmanWise,
    highestExpenseSalesman: salesmanWise[0] ?? null,
  };
}

/** Powers the §7 "Expense Breakdown" charts. */
export async function getExpenseByCategory(at: Date = new Date()) {
  const month = { from: startOfMonth(at), to: endOfMonth(at) };
  const rows = await prisma.expense.groupBy({
    by: ['categoryId'],
    where: { expenseDate: { gte: month.from, lte: month.to }, status: { in: NON_REJECTED } },
    _sum: { amount: true },
  });
  const categories = await prisma.expenseCategoryConfig.findMany({ where: { id: { in: rows.map((r) => r.categoryId) } } });
  return rows
    .map((r) => ({ name: categories.find((c) => c.id === r.categoryId)?.name ?? 'Other', total: Number(r._sum.amount ?? 0) }))
    .sort((a, b) => b.total - a.total);
}

export async function getExpenseByDay(at: Date = new Date()) {
  const month = { from: startOfMonth(at), to: endOfMonth(at) };
  const rows = await prisma.expense.findMany({
    where: { expenseDate: { gte: month.from, lte: month.to }, status: { in: NON_REJECTED } },
    select: { expenseDate: true, amount: true },
  });
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = format(row.expenseDate, 'yyyy-MM-dd');
    byDay.set(key, (byDay.get(key) ?? 0) + Number(row.amount));
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));
}

export async function getExpenseBySalesman(at: Date = new Date()) {
  const month = { from: startOfMonth(at), to: endOfMonth(at) };
  const rows = await prisma.expense.groupBy({
    by: ['salesmanId'],
    where: { expenseDate: { gte: month.from, lte: month.to }, status: { in: NON_REJECTED } },
    _sum: { amount: true },
  });
  const salesmen = await prisma.salesman.findMany({ where: { id: { in: rows.map((r) => r.salesmanId) } } });
  return rows
    .map((r) => ({ name: salesmen.find((s) => s.id === r.salesmanId)?.name ?? '—', total: Number(r._sum.amount ?? 0) }))
    .sort((a, b) => b.total - a.total);
}

/** Trailing 6-month expense trend. */
export async function getExpenseByMonth(monthsBack = 6, at: Date = new Date()) {
  const months = Array.from({ length: monthsBack }, (_, i) => subMonths(at, monthsBack - 1 - i));
  return Promise.all(
    months.map(async (m) => {
      const from = startOfMonth(m);
      const to = endOfMonth(m);
      const agg = await prisma.expense.aggregate({ where: { expenseDate: { gte: from, lte: to }, status: { in: NON_REJECTED } }, _sum: { amount: true } });
      return { month: format(m, 'MMM yyyy'), total: Number(agg._sum.amount ?? 0) };
    }),
  );
}

/**
 * §21 admin alerts that don't have a natural "just happened" event to hang
 * a push notification off of — surfaced instead as dashboard priorities,
 * same pattern as the main admin "what needs your attention today" list.
 */
export async function getExpenditureAlerts(): Promise<{ label: string; count: number; href: string }[]> {
  const staleCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const settlementOverdueCutoff = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

  const [stalePending, salesmenWithOldAdvances] = await Promise.all([
    prisma.expense.count({ where: { status: { in: ['PENDING', 'CORRECTION_REQUESTED'] }, submittedAt: { lte: staleCutoff } } }),
    prisma.salesman.findMany({
      where: { isActive: true, expenseAdvances: { some: { settlementId: null, givenAt: { lte: settlementOverdueCutoff } } } },
      select: { id: true },
    }),
  ]);

  const alerts: { label: string; count: number; href: string }[] = [];
  if (stalePending > 0) {
    alerts.push({ label: 'expenses pending approval for more than 3 days', count: stalePending, href: '/admin/expenses?status=PENDING' });
  }
  if (salesmenWithOldAdvances.length > 0) {
    alerts.push({
      label: 'salesmen with an advance settlement overdue',
      count: salesmenWithOldAdvances.length,
      href: '/admin/expenses/settlements',
    });
  }
  return alerts;
}

/** §7 "Sales vs Collection vs Expenditure" comparison, whole team. */
export async function getSalesVsCollectionVsExpense(at: Date = new Date()) {
  const month = { from: startOfMonth(at), to: endOfMonth(at) };
  const [salesAgg, collectionAgg, expenseAgg] = await Promise.all([
    prisma.order.aggregate({ where: { bookedAt: { gte: month.from, lte: month.to } }, _sum: { grandTotal: true } }),
    prisma.payment.aggregate({ where: { paidAt: { gte: month.from, lte: month.to } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { expenseDate: { gte: month.from, lte: month.to }, status: { in: ['APPROVED', 'REIMBURSED'] } }, _sum: { amount: true } }),
  ]);
  return {
    sales: Number(salesAgg._sum.grandTotal ?? 0),
    collection: Number(collectionAgg._sum.amount ?? 0),
    expense: Number(expenseAgg._sum.amount ?? 0),
  };
}
