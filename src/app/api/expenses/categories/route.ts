import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { UnauthorizedError, isAdminRole, requireAdmin } from '@/lib/auth/rbac';
import { listCategories, createCategory } from '@/lib/expense-categories';
import { expenseCategoryCreateSchema } from '@/lib/validation';
import { ok, fail } from '@/lib/api-response';

/** Any logged-in user can read the active category list (needed to fill the expense form). */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    const wantsInactive = req.nextUrl.searchParams.get('all') === 'true' && isAdminRole(session.role);
    const categories = await listCategories(wantsInactive);
    return ok(categories);
  } catch (err) {
    return fail(err);
  }
}

/** Admin-configurable categories (§5). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = expenseCategoryCreateSchema.parse(await req.json());
    const category = await createCategory({ name: body.name, code: body.code, sortOrder: body.sortOrder, actorUserId: session.userId });
    return ok(category, 201);
  } catch (err) {
    return fail(err);
  }
}
