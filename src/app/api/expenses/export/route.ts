import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { listSettlements } from '@/lib/expense-advances';
import { fail } from '@/lib/api-response';
import type { ExpenseStatus, Prisma } from '@prisma/client';

/** Quotes a CSV field, escaping embedded quotes. */
function csv(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

const REPORT_STATUS: Partial<Record<string, ExpenseStatus[]>> = {
  approved: ['APPROVED'],
  pending: ['PENDING', 'CORRECTION_REQUESTED'],
  reimbursement: ['REIMBURSED'],
};

/**
 * Expense report export (§18) — daily / salesman / monthly / category-wise /
 * approved / pending / reimbursement / advance-settlement, as CSV (opens
 * cleanly in Excel; a true .xlsx or PDF is a follow-up — see docs).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const params = req.nextUrl.searchParams;
    const report = params.get('report') ?? 'daily';
    const month = params.get('month'); // "YYYY-MM"
    const salesmanId = params.get('salesmanId') ?? undefined;

    if (report === 'advance-settlement') {
      const settlements = await listSettlements(salesmanId);
      const header = 'Salesman,Period Start,Period End,Opening Advance,New Advance,Approved Expenses,Closing Balance,Direction,Settled By,Settled At\n';
      const rows = settlements
        .map((s) =>
          [
            csv(s.salesman.name),
            csv(s.periodStart.toISOString().slice(0, 10)),
            csv(s.periodEnd.toISOString().slice(0, 10)),
            Number(s.openingAdvance).toFixed(2),
            Number(s.newAdvance).toFixed(2),
            Number(s.approvedExpenses).toFixed(2),
            Number(s.closingBalance).toFixed(2),
            csv(s.direction.replace(/_/g, ' ')),
            csv(s.settledBy.name),
            csv(s.settledAt.toISOString()),
          ].join(','),
        )
        .join('\n');
      return csvResponse('advance-settlement-report', header + rows);
    }

    let where: Prisma.ExpenseWhereInput = {};
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      where.expenseDate = { gte: start, lt: end };
    }
    if (salesmanId) where.salesmanId = salesmanId;
    const explicitStatus = params.get('status');
    if (explicitStatus) where.status = explicitStatus as ExpenseStatus;
    else {
      const statuses = REPORT_STATUS[report];
      if (statuses) where.status = { in: statuses };
    }
    const categoryId = params.get('categoryId');
    if (categoryId) where.categoryId = categoryId;
    const vendor = params.get('vendor');
    if (vendor) where.merchant = { contains: vendor, mode: 'insensitive' };

    const orderBy: Prisma.ExpenseOrderByWithRelationInput | Prisma.ExpenseOrderByWithRelationInput[] =
      report === 'salesman'
        ? [{ salesmanId: 'asc' }, { expenseDate: 'asc' }]
        : report === 'category'
          ? [{ categoryId: 'asc' }, { expenseDate: 'asc' }]
          : { expenseDate: 'asc' };

    const expenses = await prisma.expense.findMany({
      where,
      include: { salesman: { select: { name: true, employeeCode: true } }, category: { select: { name: true } } },
      orderBy,
    });

    const header =
      'Date,Salesman,Employee Code,Category,Vendor,Bill Number,Amount,GST,Payment Mode,Status,Description,Remarks\n';
    const rows = expenses
      .map((e) =>
        [
          csv(e.expenseDate.toISOString().slice(0, 10)),
          csv(e.salesman.name),
          csv(e.salesman.employeeCode),
          csv(e.category.name),
          csv(e.merchant),
          csv(e.billNumber),
          Number(e.amount).toFixed(2),
          e.gstAmount ? Number(e.gstAmount).toFixed(2) : '',
          csv(e.paymentMode),
          csv(e.status.replace(/_/g, ' ')),
          csv(e.description),
          csv(e.remarks),
        ].join(','),
      )
      .join('\n');

    return csvResponse(`${report}-expense-report`, header + rows);
  } catch (err) {
    return fail(err);
  }
}

function csvResponse(filenameBase: string, body: string) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
