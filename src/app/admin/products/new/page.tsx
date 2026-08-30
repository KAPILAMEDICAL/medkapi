import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductForm } from '@/components/admin/ProductForm';

export default async function NewProductPage() {
  const [companies, categories] = await Promise.all([
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Add Product" />
      <ProductForm
        initial={{
          name: '',
          companyId: '',
          mrp: '',
          ptr: '',
          pts: '',
          gstPercent: '12',
          stockQty: '0',
          minOrderQty: '1',
          isFastMoving: false,
          isFeatured: false,
          isActive: true,
        }}
        companies={companies}
        categories={categories}
      />
    </div>
  );
}
