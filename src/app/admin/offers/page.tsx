import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AdminOffersPage() {
  const offers = await prisma.offer.findMany({ orderBy: { startDate: 'desc' }, include: { product: true, company: true } });
  const now = new Date();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Offers & Deals"
        actions={
          <Link href="/admin/offers/new">
            <Button size="sm">
              <Plus size={16} /> Create Offer
            </Button>
          </Link>
        }
      />
      {offers.length === 0 ? (
        <EmptyState title="No offers created yet." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {offers.map((o) => {
            const active = o.isActive && o.startDate <= now && o.endDate >= now;
            return (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-semibold text-ink">{o.title}</p>
                  <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>
                </div>
                {o.schemeText && <p className="text-sm font-medium text-accent-600">{o.schemeText}</p>}
                <p className="text-xs text-ink-faint">
                  {o.startDate.toDateString()} – {o.endDate.toDateString()}
                </p>
                <p className="mt-1 text-xs text-ink-faint">{o.product?.name ?? o.company?.name ?? 'All products'}</p>
                <div className="mt-2 flex gap-1">
                  {o.visibleToCustomers && <Badge tone="brand">Customers</Badge>}
                  {o.visibleToSales && <Badge tone="info">Sales Team</Badge>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
