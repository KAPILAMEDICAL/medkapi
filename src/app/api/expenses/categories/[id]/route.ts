import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { updateCategory } from '@/lib/expense-categories';
import { expenseCategoryUpdateSchema } from '@/lib/validation';
import { ok, fail } from '@/lib/api-response';

/** Rename, reorder, or activate/deactivate a category (§5). Never hard-deleted. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = expenseCategoryUpdateSchema.parse(await req.json());
    const category = await updateCategory({ categoryId: id, actorUserId: session.userId, ...body });
    return ok(category);
  } catch (err) {
    return fail(err);
  }
}
