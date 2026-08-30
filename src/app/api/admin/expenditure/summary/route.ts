import { requireAdmin } from '@/lib/auth/rbac';
import {
  getAdminExpenditureSummary,
  getExpenseByCategory,
  getExpenseByDay,
  getExpenseBySalesman,
  getExpenseByMonth,
  getSalesVsCollectionVsExpense,
} from '@/lib/expenditure-reports';
import { ok, fail } from '@/lib/api-response';

/** Admin Expenditure Control dashboard + breakdown charts (§7/§14/§15). */
export async function GET() {
  try {
    await requireAdmin();
    const [summary, byCategory, byDay, bySalesman, byMonth, salesVsCollectionVsExpense] = await Promise.all([
      getAdminExpenditureSummary(),
      getExpenseByCategory(),
      getExpenseByDay(),
      getExpenseBySalesman(),
      getExpenseByMonth(),
      getSalesVsCollectionVsExpense(),
    ]);
    return ok({ summary, byCategory, byDay, bySalesman, byMonth, salesVsCollectionVsExpense });
  } catch (err) {
    return fail(err);
  }
}
