import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    const { id } = await params;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundError('Customer not found.');

    if (session.role === 'CUSTOMER' && customer.userId !== session.userId) {
      throw new ForbiddenError('You cannot view this statement.');
    }
    if (session.role === 'SALES_BOY') {
      const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
      if (!salesman || customer.assignedSalesmanId !== salesman.id) throw new ForbiddenError('Not your customer.');
    }

    const entries = await prisma.ledgerEntry.findMany({
      where: { customerId: id },
      orderBy: { entryDate: 'asc' },
    });

    const outstanding = entries.length > 0 ? Number(entries[entries.length - 1]!.balanceAfter) : 0;

    return ok({ entries, outstanding });
  } catch (err) {
    return fail(err);
  }
}
