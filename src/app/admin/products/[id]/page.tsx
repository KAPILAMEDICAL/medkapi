import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductForm } from '@/components/admin/ProductForm';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, companies, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-4">
      <PageHeader title="Edit Product" description={product.name} />
      <ProductForm
        initial={{
          id: product.id,
          name: product.name,
          companyId: product.companyId,
          divisionId: product.divisionId ?? undefined,
          categoryId: product.categoryId ?? undefined,
          composition: product.composition ?? '',
          packSize: product.packSize ?? '',
          sku: product.sku ?? '',
          productCode: product.productCode ?? '',
          mrp: String(product.mrp),
          ptr: product.ptr ? String(product.ptr) : '',
          pts: product.pts ? String(product.pts) : '',
          gstPercent: String(product.gstPercent),
          stockQty: String(product.stockQty),
          minOrderQty: String(product.minOrderQty),
          isFastMoving: product.isFastMoving,
          isFeatured: product.isFeatured,
          isActive: product.isActive,
        }}
        companies={companies}
        categories={categories}
      />
    </div>
  );
}
