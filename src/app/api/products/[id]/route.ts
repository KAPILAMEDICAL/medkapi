import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { resolveVisiblePrice } from '@/lib/pricing';
import { PRODUCT_INCLUDE } from '@/lib/search';
import { ok, fail } from '@/lib/api-response';
import { NotFoundError, UnauthorizedError } from '@/lib/auth/rbac';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in to view this product.');
    const { id } = await params;

    const product = await prisma.product.findFirst({
      where: { id, isActive: true, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundError('Product not found.');

    const visibility = session.role === 'CUSTOMER'
      ? (await prisma.customer.findUnique({ where: { userId: session.userId } }))?.priceVisibility ?? 'MRP_ONLY'
      : 'ALL_PRICES';

    const related = await prisma.product.findMany({
      where: { categoryId: product.categoryId, id: { not: product.id }, isActive: true },
      take: 6,
      include: PRODUCT_INCLUDE,
    });

    const activeOffers = await prisma.offer.findMany({
      where: {
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
        OR: [{ productId: product.id }, { companyId: product.companyId }],
        ...(session.role === 'CUSTOMER' ? { visibleToCustomers: true } : { visibleToSales: true }),
      },
    });

    return ok({
      ...product,
      price: resolveVisiblePrice(product, visibility),
      related: related.map((p) => ({ ...p, price: resolveVisiblePrice(p, visibility) })),
      offers: activeOffers,
    });
  } catch (err) {
    return fail(err);
  }
}
