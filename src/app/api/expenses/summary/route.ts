import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/rbac';
import { getSalesmanExpenditureSummary } from '@/lib/expenses';
import { getOpenBalance } from '@/lib/expense-advances';
import { ok, fail } from '@/lib/api-response';

/** Powers the "💳 MY EXPENDITURE" dashboard (§1). */
export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== 'SALES_BOY' && session.role !== 'SALES_MANAGER')) {
      throw new UnauthorizedError('Please log in as a sales team member.');
    }
    const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
    if (!salesman) throw new ForbiddenError('No sales profile found.');

    const [summary, openBalance] = await Promise.all([getSalesmanExpenditureSummary(salesman.id), getOpenBalance(salesman.id)]);

    return ok({ ...summary, advanceBalance: openBalance });
  } catch (err) {
    return fail(err);
  }
}
