import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError, isAdminRole, requireAdmin } from '@/lib/auth/rbac';
import { giveAdvance, listAdvances } from '@/lib/expense-advances';
import { expenseAdvanceSchema } from '@/lib/validation';
import { ok, fail } from '@/lib/api-response';

/** Admin sees the whole team (optionally filtered); a salesman only ever sees their own (§12). */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    let salesmanId = req.nextUrl.searchParams.get('salesmanId') ?? undefined;
    if (session.role === 'SALES_BOY') {
      const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
      if (!salesman) throw new ForbiddenError('No sales profile found.');
      salesmanId = salesman.id;
    } else if (!isAdminRole(session.role)) {
      throw new ForbiddenError('Not permitted to view advances.');
    }

    const advances = await listAdvances(salesmanId);
    return ok(advances);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = expenseAdvanceSchema.parse(await req.json());
    const advance = await giveAdvance({ salesmanId: body.salesmanId, amount: body.amount, purpose: body.purpose, givenByUserId: session.userId });
    return ok(advance, 201);
  } catch (err) {
    return fail(err);
  }
}
