import Link from 'next/link';
import { CheckCircle2, Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default async function SalesOrdersPage({ searchParams }: { searchParams: Promise<{ justBooked?: string }> }) {
  const { justBooked } = await searchParams;
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const orders = await prisma.order.findMany({
    where: { salesmanId: salesman.id },
    include: { customer: { select: { firmName: true } } },
    orderBy: { bookedAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      {justBooked && (
        <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 size={18} />
          Order {justBooked} booked successfully!
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">My Orders</h1>
        <Link href="/sales/orders/new">
          <Button size="sm">
            <Plus size={16} /> Book Order
          </Button>
        </Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No orders booked yet." />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-ink">{o.orderNumber}</p>
                <p className="text-xs text-ink-faint">{o.customer.firmName} · {o.bookedAt.toDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-ink">₹{Number(o.grandTotal).toFixed(2)}</p>
                <StatusBadge status={o.status} kind="order" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
