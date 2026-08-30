import Link from 'next/link';
import { Plus, Wallet, AlertTriangle } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { getSalesmanExpenditureSummary } from '@/lib/expenses';
import { getOpenBalance } from '@/lib/expense-advances';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default async function SalesExpensesPage() {
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const [summary, advanceBalance, recentExpenses] = await Promise.all([
    getSalesmanExpenditureSummary(salesman.id),
    getOpenBalance(salesman.id),
    prisma.expense.findMany({
      where: { salesmanId: salesman.id },
      include: { category: { select: { name: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 15,
    }),
  ]);

  const limitPercent = Math.min(100, Math.round((summary.limit.used / Math.max(1, summary.limit.monthlyLimit)) * 100));

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-lg font-semibold text-ink">
          <Wallet size={20} className="text-brand-600" /> My Expenditure
        </h1>
        <Link href="/sales/expenses/new">
          <Button size="sm">
            <Plus size={16} /> Add Expense
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Today" value={`₹${summary.today.toFixed(0)}`} />
        <StatCard label="This Week" value={`₹${summary.week.toFixed(0)}`} />
        <StatCard label="This Month" value={`₹${summary.month.toFixed(0)}`} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Approved" value={`₹${summary.approved.toFixed(0)}`} tone="success" />
        <StatCard label="Pending" value={`₹${summary.pending.toFixed(0)}`} tone="warning" />
        <StatCard label="Rejected" value={`₹${summary.rejected.toFixed(0)}`} tone="danger" />
        <StatCard label="Reimbursed" value={`₹${summary.reimbursed.toFixed(0)}`} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-faint">
          <span>Monthly Expense Limit</span>
          <span>₹{summary.limit.used.toFixed(0)} / ₹{summary.limit.monthlyLimit.toFixed(0)}</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className={`h-full ${summary.limit.exceeded ? 'bg-danger' : limitPercent > 80 ? 'bg-warning' : 'bg-brand-600'}`}
            style={{ width: `${limitPercent}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">Remaining: ₹{summary.limit.remaining.toFixed(0)}</p>
        {summary.limit.exceeded && (
          <p className="mt-2 flex items-center gap-1.5 rounded-sm bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">
            <AlertTriangle size={14} /> Expense limit exceeded — further expenses need admin approval.
          </p>
        )}
      </Card>

      {summary.categoryBreakdown.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">This Month by Category</p>
          <ul className="space-y-1.5 text-sm">
            {summary.categoryBreakdown.map((c) => (
              <li key={c.categoryId} className="flex items-center justify-between">
                <span className="text-ink-muted">{c.categoryName}</span>
                <span className="font-medium text-ink">₹{c.total.toFixed(0)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-ink-faint/10 pt-2 text-sm font-semibold text-ink">
            <span>Total</span>
            <span>₹{summary.month.toFixed(0)}</span>
          </div>
        </Card>
      )}

      <Link href="/sales/expenses/advance">
        <Card className="flex items-center justify-between p-4 hover:border-brand-300">
          <div>
            <p className="text-sm font-medium text-ink">Travel Advance & Settlement</p>
            <p className="text-xs text-ink-muted">
              {advanceBalance >= 0 ? `You are holding ₹${advanceBalance.toFixed(0)} of unspent advance.` : `₹${Math.abs(advanceBalance).toFixed(0)} reimbursement is due to you.`}
            </p>
          </div>
          <p className={`text-base font-semibold ${advanceBalance >= 0 ? 'text-ink' : 'text-success'}`}>₹{Math.abs(advanceBalance).toFixed(0)}</p>
        </Card>
      </Link>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Recent Expenses</p>
        {recentExpenses.length === 0 ? (
          <EmptyState
            title="No expenses submitted yet."
            description="Take a photo of your first bill or enter an expense manually."
            action={
              <Link href="/sales/expenses/new">
                <Button size="sm">+ Add Expense</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {recentExpenses.map((e) => (
              <Link key={e.id} href={`/sales/expenses/${e.id}`}>
                <Card className="flex items-center justify-between p-3 hover:border-brand-300">
                  <div>
                    <p className="text-sm font-medium text-ink">{e.category.name}</p>
                    <p className="text-xs text-ink-faint">{e.merchant ?? '—'} · {e.expenseDate.toDateString()}</p>
                    {e.isPossibleDuplicate && <p className="text-xs text-warning">⚠️ Flagged as possible duplicate</p>}
                    {e.status === 'REJECTED' && e.adminRemarks && <p className="text-xs text-danger">{e.adminRemarks}</p>}
                    {e.status === 'CORRECTION_REQUESTED' && <p className="text-xs text-info">Correction needed — tap to fix</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-ink">₹{Number(e.amount).toFixed(2)}</p>
                    <StatusBadge status={e.status} kind="expense" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
