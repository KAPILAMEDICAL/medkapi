import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { resolveVisiblePrice } from '@/lib/pricing';
import { PRODUCT_INCLUDE } from '@/lib/search';
import { ProductCard } from '@/components/product/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { userId: session!.userId } });
  if (!customer) notFound();

  const company = await prisma.company.findFirst({
    where: { id, isActive: true },
    include: { divisions: { orderBy: { name: 'asc' } } },
  });
  if (!company) notFound();

  const products = await prisma.product.findMany({
    where: { companyId: company.id, isActive: true },
    orderBy: { name: 'asc' },
    include: PRODUCT_INCLUDE,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{company.name}</h1>
        {company.description && <p className="text-sm text-ink-muted">{company.description}</p>}
        {company.divisions.length > 0 && (
          <p className="mt-1 text-xs text-ink-faint">Divisions: {company.divisions.map((d) => d.name).join(', ')}</p>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState title="No products listed for this company yet." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} basePath="/customer/products" product={{ ...p, price: resolveVisiblePrice(p, customer.priceVisibility) }} />
          ))}
        </div>
      )}
    </div>
  );
}
