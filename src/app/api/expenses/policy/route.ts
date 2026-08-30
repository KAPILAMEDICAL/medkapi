import { getCurrentUser } from '@/lib/auth/session';
import { UnauthorizedError } from '@/lib/auth/rbac';
import { getBillRequiredAboveAmount } from '@/lib/expenses';
import { ok, fail } from '@/lib/api-response';

/** Company policy the "Add Expense" form needs before the user starts typing (§4). */
export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    return ok({ billRequiredAboveAmount: await getBillRequiredAboveAmount() });
  } catch (err) {
    return fail(err);
  }
}
