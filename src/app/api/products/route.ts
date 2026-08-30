import { NextRequest } from 'next/server';
import { searchProducts } from '@/lib/search';
import { resolveVisiblePrice } from '@/lib/pricing';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { ok, fail } from '@/lib/api-response';
import { UnauthorizedError } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in to view products.');

    const params = req.nextUrl.searchParams;
    const { items, total, page, pageSize } = await searchProducts({
      query: params.get('query') ?? undefined,
      companyId: params.get('companyId') ?? undefined,
      categoryId: params.get('categoryId') ?? undefined,
      isFastMoving: params.get('fastMoving') === 'true',
      isFeatured: params.get('featured') === 'true',
      onlyNew: params.get('new') === 'true',
      page: params.get('page') ? Number(params.get('page')) : undefined,
      pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
    });

    const visibility = session.role === 'CUSTOMER'
      ? (await prisma.customer.findUnique({ where: { userId: session.userId } }))?.priceVisibility ?? 'MRP_ONLY'
      : 'ALL_PRICES';

    const data = items.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      composition: p.composition,
      packSize: p.packSize,
      imageUrl: p.imageUrl,
      company: p.company,
      division: p.division,
      category: p.category,
      isFastMoving: p.isFastMoving,
      isFeatured: p.isFeatured,
      stockQty: p.stockQty,
      minOrderQty: p.minOrderQty,
      price: resolveVisiblePrice(p, visibility),
    }));

    return ok({ items: data, total, page, pageSize });
  } catch (err) {
    return fail(err);
  }
}
