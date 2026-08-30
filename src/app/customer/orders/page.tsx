import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function CustomerOrdersPage() {
  const session = await getCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { userId: session!.userId } });
  if (!customer) return null;

  const orders = await prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { bookedAt: 'desc' } });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">My Orders</h1>
      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet."
          description="Search for products and book your first order."
          action={
            <Link href="/customer/products" className="text-sm font-medium text-brand-600 underline">
              Browse products
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link key={o.id} href={`/customer/orders/${o.id}`}>
              <Card className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{o.orderNumber}</p>
                  <p className="text-xs text-ink-faint">{o.bookedAt.toDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-ink">₹{Number(o.grandTotal).toFixed(2)}</p>
                  <StatusBadge status={o.status} kind="order" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
