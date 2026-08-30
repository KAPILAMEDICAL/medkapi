import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/auth/rbac';
import { fail } from '@/lib/api-response';

/** Downloadable CSV account statement (Master Prompt §18 "Download Statement"). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    const { id } = await params;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundError('Customer not found.');
    if (session.role === 'CUSTOMER' && customer.userId !== session.userId) {
      throw new ForbiddenError('You cannot download this statement.');
    }

    const entries = await prisma.ledgerEntry.findMany({ where: { customerId: id }, orderBy: { entryDate: 'asc' } });

    const header = 'Date,Description,Debit,Credit,Balance\n';
    const rows = entries
      .map((e) =>
        [
          e.entryDate.toISOString().slice(0, 10),
          `"${e.description.replace(/"/g, '""')}"`,
          Number(e.debit).toFixed(2),
          Number(e.credit).toFixed(2),
          Number(e.balanceAfter).toFixed(2),
        ].join(','),
      )
      .join('\n');

    return new Response(header + rows, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="statement-${customer.firmName.replace(/\s+/g, '-')}.csv"`,
      },
    });
  } catch (err) {
    return fail(err);
  }
}
