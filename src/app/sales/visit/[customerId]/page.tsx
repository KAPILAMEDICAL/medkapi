import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Phone, MapPin, ClipboardList, IndianRupee, BookOpen } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { FinishVisitButton } from '@/components/sales/FinishVisitButton';

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ visitId?: string }>;
}) {
  const { customerId } = await params;
  const { visitId } = await searchParams;
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const customer = await prisma.customer.findFirst({ where: { id: customerId, assignedSalesmanId: salesman.id } });
  if (!customer) notFound();

  const [lastOrder, lastPayment, lastLedger, frequentProducts] = await Promise.all([
    prisma.order.findFirst({ where: { customerId }, orderBy: { bookedAt: 'desc' } }),
    prisma.payment.findFirst({ where: { customerId }, orderBy: { paidAt: 'desc' } }),
    prisma.ledgerEntry.findFirst({ where: { customerId }, orderBy: { entryDate: 'desc' } }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { customerId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ]);

  const productIds = frequentProducts.map((f) => f.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const outstanding = lastLedger ? Number(lastLedger.balanceAfter) : 0;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h1 className="text-lg font-semibold text-ink">{customer.firmName}</h1>
        <p className="text-sm text-ink-muted">{customer.ownerName}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
          <MapPin size={14} /> {customer.address}, {customer.city}
        </p>
        <p className="flex items-center gap-1 text-sm text-ink-muted">
          <Phone size={14} /> {customer.mobile}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-ink-faint">Outstanding</p>
            <p className={`font-semibold ${outstanding > 0 ? 'text-warning' : 'text-success'}`}>₹{outstanding.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-faint">Last Order</p>
            <p className="font-medium text-ink">{lastOrder ? `₹${Number(lastOrder.grandTotal).toFixed(2)} on ${lastOrder.bookedAt.toDateString()}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-faint">Last Payment</p>
            <p className="font-medium text-ink">{lastPayment ? `₹${Number(lastPayment.amount).toFixed(2)} on ${lastPayment.paidAt.toDateString()}` : '—'}</p>
          </div>
        </div>
      </Card>

      {products.length > 0 && (
        <Card className="p-4">
          <p className="mb-1 text-xs font-medium uppercase text-ink-faint">Frequently Purchased</p>
          <ul className="text-sm text-ink">
            {products.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2">
        <QuickLink href={`/sales/orders/new?customerId=${customer.id}`} icon={ClipboardList} label="Book Order" />
        <QuickLink href={`/sales/payments/new?customerId=${customer.id}`} icon={IndianRupee} label="Payment" />
        <QuickLink href={`/sales/customers/${customer.id}`} icon={BookOpen} label="Ledger" />
      </div>

      {visitId && (
        <Card className="p-4">
          <FinishVisitButton visitId={visitId} />
        </Card>
      )}
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof ClipboardList; label: string }) {
  return (
    <Link href={href}>
      <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-ink-faint/15 bg-surface p-3 text-center shadow-card hover:border-brand-300">
        <Icon size={18} className="text-brand-600" />
        <span className="text-xs font-medium text-ink">{label}</span>
      </div>
    </Link>
  );
}
