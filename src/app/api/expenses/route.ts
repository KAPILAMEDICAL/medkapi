import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError, isAdminRole } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { createExpense } from '@/lib/expenses';
import { expenseEntrySchema } from '@/lib/validation';
import type { ExpenseStatus, Prisma } from '@prisma/client';

/**
 * Expense search & filter (§17). Sales staff only ever see their own
 * expenses; admins can filter across the whole team.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    const params = req.nextUrl.searchParams;
    let where: Prisma.ExpenseWhereInput = {};

    const status = params.get('status');
    if (status) where.status = status as ExpenseStatus;

    const categoryId = params.get('categoryId');
    if (categoryId) where.categoryId = categoryId;

    const vendor = params.get('vendor') ?? params.get('q');
    if (vendor) {
      where.OR = [
        { merchant: { contains: vendor, mode: 'insensitive' } },
        { billNumber: { contains: vendor, mode: 'insensitive' } },
        { description: { contains: vendor, mode: 'insensitive' } },
      ];
    }

    const month = params.get('month'); // "YYYY-MM"
    const from = params.get('from');
    const to = params.get('to');
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      where.expenseDate = { gte: start, lt: end };
    } else if (from || to) {
      where.expenseDate = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    }

    const minAmount = params.get('minAmount');
    const maxAmount = params.get('maxAmount');
    if (minAmount || maxAmount) {
      where.amount = { ...(minAmount ? { gte: Number(minAmount) } : {}), ...(maxAmount ? { lte: Number(maxAmount) } : {}) };
    }

    if (params.get('duplicatesOnly') === 'true') where.isPossibleDuplicate = true;
    if (params.get('withLocation') === 'true') where.latitude = { not: null };

    if (session.role === 'SALES_BOY') {
      const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
      if (!salesman) throw new ForbiddenError('No sales profile found.');
      where = { ...where, salesmanId: salesman.id };
    } else if (!isAdminRole(session.role)) {
      throw new ForbiddenError('Not permitted to view expenses.');
    } else {
      const salesmanId = params.get('salesmanId');
      if (salesmanId) where = { ...where, salesmanId };
    }

    const items = await prisma.expense.findMany({
      where,
      include: { salesman: { select: { name: true } }, category: { select: { name: true, code: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 200,
    });

    return ok(items);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    if (session.role !== 'SALES_BOY' && session.role !== 'SALES_MANAGER') {
      throw new ForbiddenError('Only sales staff can submit expenses.');
    }
    const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
    if (!salesman) throw new ForbiddenError('No sales profile found.');

    const body = expenseEntrySchema.parse(await req.json());

    const expense = await createExpense({
      salesmanId: salesman.id,
      categoryId: body.categoryId,
      amount: body.amount,
      gstAmount: body.gstAmount,
      expenseDate: new Date(body.expenseDate),
      merchant: body.merchant,
      billNumber: body.billNumber,
      paymentMode: body.paymentMode,
      description: body.description,
      remarks: body.remarks,
      billImageUrl: body.billImageUrl,
      ocrRawText: body.ocrRawText,
      ocrConfidence: body.ocrConfidence,
      ocrProvider: body.ocrProvider,
      location: body.location,
    });

    return ok({ expenseId: expense.id, isPossibleDuplicate: expense.isPossibleDuplicate }, 201);
  } catch (err) {
    return fail(err);
  }
}
