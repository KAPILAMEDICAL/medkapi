import Link from 'next/link';
import { Phone } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function SalesCustomersPage() {
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const customers = await prisma.customer.findMany({
    where: { assignedSalesmanId: salesman.id, status: 'APPROVED' },
    orderBy: { firmName: 'asc' },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">My Customers</h1>
      {customers.length === 0 ? (
        <EmptyState title="No customers assigned." description="Ask your manager to assign customers to you." />
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <Link key={c.id} href={`/sales/customers/${c.id}`}>
              <Card className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{c.firmName}</p>
                  <p className="text-xs text-ink-faint">{c.city}</p>
                </div>
                <p className="flex items-center gap-1 text-xs text-ink-muted">
                  <Phone size={12} /> {c.mobile}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
