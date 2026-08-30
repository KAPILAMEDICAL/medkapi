import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag } from 'lucide-react';

export default async function OffersPage() {
  const now = new Date();
  const offers = await prisma.offer.findMany({
    where: { isActive: true, visibleToCustomers: true, startDate: { lte: now }, endDate: { gte: now } },
    include: { product: true, company: true },
    orderBy: { startDate: 'desc' },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">Offers &amp; Deals</h1>
      {offers.length === 0 ? (
        <EmptyState title="No offers available right now." description="Check back soon for new schemes and deals." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {offers.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-accent-500/10 text-accent-600">
                <Tag size={16} />
              </div>
              <p className="text-sm font-semibold text-ink">{o.title}</p>
              {o.schemeText && <p className="text-sm font-medium text-accent-600">{o.schemeText}</p>}
              {o.description && <p className="mt-1 text-sm text-ink-muted">{o.description}</p>}
              <p className="mt-2 text-xs text-ink-faint">
                Valid till {o.endDate.toDateString()}
                {o.minQty ? ` · Min. qty ${o.minQty}` : ''}
              </p>
              {(o.product || o.company) && (
                <p className="mt-1 text-xs text-ink-faint">{o.product?.name ?? o.company?.name}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
