import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default async function SalesPaymentsPage() {
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const payments = await prisma.payment.findMany({
    where: { salesmanId: salesman.id },
    include: { customer: { select: { firmName: true } } },
    orderBy: { paidAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">My Payments</h1>
        <Link href="/sales/payments/new">
          <Button size="sm">
            <Plus size={16} /> Payment
          </Button>
        </Link>
      </div>

      {payments.length === 0 ? (
        <EmptyState title="No payments recorded yet." />
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <Card key={p.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-ink">{p.customer.firmName}</p>
                <p className="text-xs text-ink-faint">{p.paymentNumber} · {p.mode} · {p.paidAt.toDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-ink">₹{Number(p.amount).toFixed(2)}</p>
                <StatusBadge status={p.status} kind="payment" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
