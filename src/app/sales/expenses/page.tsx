import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default async function SalesExpensesPage() {
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const expenses = await prisma.expense.findMany({ where: { salesmanId: salesman.id }, orderBy: { submittedAt: 'desc' }, take: 100 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">My Expenses</h1>
        <Link href="/sales/expenses/new">
          <Button size="sm">
            <Plus size={16} /> New
          </Button>
        </Link>
      </div>

      {expenses.length === 0 ? (
        <EmptyState title="No expenses submitted yet." />
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <Card key={e.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-ink">{e.category.replace(/_/g, ' ')}</p>
                <p className="text-xs text-ink-faint">{e.merchant ?? '—'} · {e.expenseDate.toDateString()}</p>
                {e.status === 'REJECTED' && e.rejectionReason && <p className="text-xs text-danger">{e.rejectionReason}</p>}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-ink">₹{Number(e.amount).toFixed(2)}</p>
                <StatusBadge status={e.status} kind="expense" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
