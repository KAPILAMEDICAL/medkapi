import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError, isAdminRole, requireAdmin } from '@/lib/auth/rbac';
import { closeSettlement, computeSettlementPreview, listSettlements } from '@/lib/expense-advances';
import { expenseSettlementSchema } from '@/lib/validation';
import { ok, fail } from '@/lib/api-response';

/** Admin sees the whole team's settlement history; a salesman only their own (§13). */
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
      throw new ForbiddenError('Not permitted to view settlements.');
    }

    // A live, unsaved preview of the current open period — lets the admin
    // (or the salesman, read-only) see where things stand before closing it.
    const previewParam = req.nextUrl.searchParams.get('previewFrom');
    const previewTo = req.nextUrl.searchParams.get('previewTo');
    if (previewParam && previewTo && salesmanId) {
      const preview = await computeSettlementPreview(salesmanId, new Date(previewParam), new Date(previewTo));
      return ok({ preview, history: await listSettlements(salesmanId) });
    }

    return ok(await listSettlements(salesmanId));
  } catch (err) {
    return fail(err);
  }
}

/** Closes a month-end (or custom-period) settlement for one salesman (§13). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = expenseSettlementSchema.parse(await req.json());
    const settlement = await closeSettlement({
      salesmanId: body.salesmanId,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      settledByUserId: session.userId,
      notes: body.notes,
    });
    return ok(settlement, 201);
  } catch (err) {
    return fail(err);
  }
}
