import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError, isAdminRole } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { createExpense } from '@/lib/expenses';
import { expenseEntrySchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    const params = req.nextUrl.searchParams;
    const status = params.get('status');
    let where: Record<string, unknown> = { ...(status ? { status } : {}) };

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
      include: { salesman: { select: { name: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 100,
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
      category: body.category,
      amount: body.amount,
      expenseDate: new Date(body.expenseDate),
      merchant: body.merchant,
      description: body.description,
      billImageUrl: body.billImageUrl,
      ocrRawText: body.ocrRawText,
      ocrConfidence: body.ocrConfidence,
      ocrProvider: body.ocrProvider,
    });

    return ok({ expenseId: expense.id }, 201);
  } catch (err) {
    return fail(err);
  }
}
