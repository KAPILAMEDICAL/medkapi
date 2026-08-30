import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { NotFoundError, UnauthorizedError } from '@/lib/auth/rbac';
import { resolveVisiblePrice } from '@/lib/pricing';
import { ok, fail } from '@/lib/api-response';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    const { id } = await params;

    const company = await prisma.company.findFirst({
      where: { OR: [{ id }, { slug: id }], isActive: true },
      include: { divisions: { orderBy: { name: 'asc' } } },
    });
    if (!company) throw new NotFoundError('Company not found.');

    const visibility = session.role === 'CUSTOMER'
      ? (await prisma.customer.findUnique({ where: { userId: session.userId } }))?.priceVisibility ?? 'MRP_ONLY'
      : 'ALL_PRICES';

    const products = await prisma.product.findMany({
      where: { companyId: company.id, isActive: true },
      orderBy: { name: 'asc' },
      include: { company: true, division: true, category: true },
    });

    return ok({
      ...company,
      products: products.map((p) => ({ ...p, price: resolveVisiblePrice(p, visibility) })),
    });
  } catch (err) {
    return fail(err);
  }
}
