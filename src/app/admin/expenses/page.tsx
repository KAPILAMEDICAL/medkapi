import Image from 'next/image';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/admin/ActionButton';

export default async function AdminExpensesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  const expenses = await prisma.expense.findMany({
    where: status ? { status: status as never } : {},
    include: { salesman: { select: { name: true } } },
    orderBy: { submittedAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Expenses" description={`${expenses.length} expense(s)`} />

      {expenses.length === 0 ? (
        <EmptyState title="No expenses submitted yet." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {expenses.map((e) => (
            <Card key={e.id} className="flex gap-3 p-4">
              {e.billImageUrl && (
                <Image src={e.billImageUrl} alt="Bill" width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-sm object-cover" />
              )}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{e.salesman.name}</p>
                    <p className="text-xs text-ink-faint">{e.category.replace(/_/g, ' ')} · {e.merchant ?? '—'}</p>
                    <p className="text-xs text-ink-faint">{e.expenseDate.toDateString()}</p>
                  </div>
                  <StatusBadge status={e.status} kind="expense" />
                </div>
                <p className="mt-1 text-sm font-semibold text-ink">₹{Number(e.amount).toFixed(2)}</p>
                {e.status === 'SUBMITTED' && (
                  <div className="mt-2 flex gap-1.5">
                    <ActionButton url={`/api/expenses/${e.id}`} body={{ decision: 'APPROVED' }}>
                      Approve
                    </ActionButton>
                    <ActionButton url={`/api/expenses/${e.id}`} body={{ decision: 'REJECTED', rejectionReason: 'Not a valid business expense' }} variant="outline">
                      Reject
                    </ActionButton>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
