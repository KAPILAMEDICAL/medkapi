import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Package } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { resolveVisiblePrice, orderingUnitPrice } from '@/lib/pricing';
import { PRODUCT_INCLUDE } from '@/lib/search';
import { Badge } from '@/components/ui/Badge';
import { ProductCard } from '@/components/product/ProductCard';
import { AddToCartBar } from '@/components/product/AddToCartBar';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { userId: session!.userId } });
  if (!customer) notFound();

  const product = await prisma.product.findFirst({ where: { id, isActive: true }, include: PRODUCT_INCLUDE });
  if (!product) notFound();

  const price = resolveVisiblePrice(product, customer.priceVisibility);
  const unitPrice = orderingUnitPrice(product);

  const [related, offers] = await Promise.all([
    prisma.product.findMany({ where: { categoryId: product.categoryId, id: { not: product.id }, isActive: true }, include: PRODUCT_INCLUDE, take: 4 }),
    prisma.offer.findMany({
      where: {
        isActive: true,
        visibleToCustomers: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
        OR: [{ productId: product.id }, { companyId: product.companyId }],
      },
    }),
  ]);

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex h-56 items-center justify-center rounded-md bg-surface-subtle">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} width={200} height={200} className="h-full w-full object-contain" />
          ) : (
            <Package className="text-ink-faint" size={48} />
          )}
        </div>
        <div>
          <div className="mb-1 flex gap-1.5">
            {product.isFastMoving && <Badge tone="brand">Fast Moving</Badge>}
            {product.isFeatured && <Badge tone="info">Featured</Badge>}
            {product.stockQty > 0 ? <Badge tone="success">In Stock</Badge> : <Badge tone="danger">Out of Stock</Badge>}
          </div>
          <h1 className="text-xl font-semibold text-ink">{product.name}</h1>
          <p className="text-sm text-ink-muted">{product.company.name}{product.division ? ` · ${product.division.name}` : ''}</p>
          {product.composition && <p className="mt-2 text-sm text-ink">{product.composition}</p>}
          {product.packSize && <p className="text-sm text-ink-faint">Pack: {product.packSize}</p>}

          <div className="mt-4 space-y-1">
            <p className="text-2xl font-semibold text-ink">MRP ₹{price.mrp.toFixed(2)}</p>
            {price.ptr !== null && <p className="text-sm text-ink-muted">Trade price (PTR): ₹{price.ptr.toFixed(2)}</p>}
            {price.pts !== null && <p className="text-sm text-ink-muted">Stockist price (PTS): ₹{price.pts.toFixed(2)}</p>}
          </div>
          <p className="mt-1 text-xs text-ink-faint">Minimum order quantity: {product.minOrderQty}</p>

          {offers.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {offers.map((o) => (
                <div key={o.id} className="rounded-md bg-accent-500/10 px-3 py-2 text-sm text-accent-600">
                  {o.title} {o.schemeText ? `— ${o.schemeText}` : ''}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 hidden md:block">
            <AddToCartBar
              product={{
                id: product.id,
                name: product.name,
                packSize: product.packSize,
                imageUrl: product.imageUrl,
                unitPrice,
                minOrderQty: product.minOrderQty,
              }}
            />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Related Products</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} basePath="/customer/products" product={{ ...p, price: resolveVisiblePrice(p, customer.priceVisibility) }} />
            ))}
          </div>
        </section>
      )}

      <div className="md:hidden">
        <AddToCartBar
          product={{
            id: product.id,
            name: product.name,
            packSize: product.packSize,
            imageUrl: product.imageUrl,
            unitPrice,
            minOrderQty: product.minOrderQty,
          }}
        />
      </div>
    </div>
  );
}
