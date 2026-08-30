import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import { reviewExpense } from '@/lib/expenses';
import { ok, fail } from '@/lib/api-response';

const patchSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().trim().max(300).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const expense = await reviewExpense({
      expenseId: id,
      reviewedByUserId: session.userId,
      decision: body.decision,
      rejectionReason: body.rejectionReason,
    });
    return ok(expense);
  } catch (err) {
    return fail(err);
  }
}
