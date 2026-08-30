import Link from 'next/link';
import { Search, Tag, Sparkles, TrendingUp, Building2 } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductCard } from '@/components/product/ProductCard';
import { resolveVisiblePrice } from '@/lib/pricing';
import { PRODUCT_INCLUDE, type ProductWithRelations } from '@/lib/search';
import type { PriceVisibility } from '@prisma/client';

export default async function CustomerHomePage() {
  const session = await getCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { userId: session!.userId } });
  if (!customer) return null;

  const [lastLedger, recentOrders, activeOffers, fastMoving, newProducts] = await Promise.all([
    prisma.ledgerEntry.findFirst({ where: { customerId: customer.id }, orderBy: { entryDate: 'desc' } }),
    prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { bookedAt: 'desc' }, take: 3 }),
    prisma.offer.count({
      where: { isActive: true, visibleToCustomers: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
    }),
    prisma.product.findMany({ where: { isActive: true, isFastMoving: true }, include: PRODUCT_INCLUDE, take: 4 }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' }, include: PRODUCT_INCLUDE, take: 4 }),
  ]);

  const outstanding = lastLedger ? Number(lastLedger.balanceAfter) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Welcome, {customer.firmName}</h1>
        <p className="text-sm text-ink-muted">{customer.city} · Kapila Medical Agencies</p>
      </div>

      <Link href="/customer/products">
        <div className="flex items-center gap-2 rounded-md border border-ink-faint/30 bg-surface px-4 py-3 text-ink-faint">
          <Search size={18} />
          Search products, companies, compositions…
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Outstanding" value={`₹${outstanding.toFixed(2)}`} tone={outstanding > 0 ? 'warning' : 'success'} />
        <Link href="/customer/orders">
          <StatCard label="Recent Orders" value={String(recentOrders.length)} />
        </Link>
        <Link href="/customer/offers">
          <StatCard label="Active Offers" value={String(activeOffers)} tone="success" />
        </Link>
        <Link href="/customer/products?new=true">
          <StatCard label="New Products" value={String(newProducts.length)} />
        </Link>
      </div>

      <QuickLinks />

      <Section title="Today's Best Deals" icon={Tag} href="/customer/offers">
        {activeOffers === 0 ? (
          <EmptyState title="No offers available right now." description="Check back soon for new schemes and deals." />
        ) : (
          <p className="text-sm text-ink-muted">{activeOffers} active offer(s) — view all in Offers.</p>
        )}
      </Section>

      <Section title="Fast Moving Products" icon={TrendingUp} href="/customer/products?fastMoving=true">
        <ProductGridPreview products={fastMoving} visibility={customer.priceVisibility} />
      </Section>

      <Section title="New Products" icon={Sparkles} href="/customer/products?new=true">
        <ProductGridPreview products={newProducts} visibility={customer.priceVisibility} />
      </Section>

      <Section title="Recent Orders" icon={Building2} href="/customer/orders">
        {recentOrders.length === 0 ? (
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
            {recentOrders.map((o) => (
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
      </Section>
    </div>
  );
}

function QuickLinks() {
  const links = [
    { href: '/customer/companies', label: 'Companies' },
    { href: '/customer/offers', label: 'Offers' },
    { href: '/customer/orders', label: 'Orders' },
    { href: '/customer/account', label: 'Statement' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {links.map((l) => (
        <Link key={l.href} href={l.href}>
          <div className="rounded-md border border-ink-faint/15 bg-surface px-2 py-3 text-center text-xs font-medium text-ink hover:bg-surface-subtle">
            {l.label}
          </div>
        </Link>
      ))}
    </div>
  );
}

function Section({ title, icon: Icon, href, children }: { title: string; icon: typeof Tag; href: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon size={16} className="text-brand-600" />
          {title}
        </h2>
        <Link href={href} className="text-xs font-medium text-brand-600">
          View all
        </Link>
      </div>
      {children}
    </section>
  );
}

function ProductGridPreview({ products, visibility }: { products: ProductWithRelations[]; visibility: PriceVisibility }) {
  if (products.length === 0) return <EmptyState title="No products to show yet." />;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} basePath="/customer/products" product={{ ...p, price: resolveVisiblePrice(p, visibility) }} />
      ))}
    </div>
  );
}
