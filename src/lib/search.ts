import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Typo-tolerant, partial-word product search (Master Prompt §7).
 *
 * Uses PostgreSQL's pg_trgm extension (see prisma/migrations/*add_trgm*)
 * for fuzzy matching on product name/composition/company name, combined
 * with plain substring matches on SKU/product code so exact codes still
 * work. Falls back to a simple alphabetical listing when no query text
 * is given (browsing by category/company/flags).
 */

export const PRODUCT_INCLUDE = {
  company: { select: { id: true, name: true, slug: true, logoUrl: true } },
  division: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  images: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

export interface ProductSearchParams {
  query?: string;
  companyId?: string;
  categoryId?: string;
  isFastMoving?: boolean;
  isFeatured?: boolean;
  onlyNew?: boolean;
  page?: number;
  pageSize?: number;
}

export async function searchProducts(params: ProductSearchParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const skip = (page - 1) * pageSize;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const baseWhere: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
    ...(params.companyId ? { companyId: params.companyId } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.isFastMoving ? { isFastMoving: true } : {}),
    ...(params.isFeatured ? { isFeatured: true } : {}),
    ...(params.onlyNew ? { createdAt: { gte: thirtyDaysAgo } } : {}),
  };

  const q = params.query?.trim();

  if (!q) {
    const [items, total] = await Promise.all([
      prisma.product.findMany({ where: baseWhere, include: PRODUCT_INCLUDE, orderBy: { name: 'asc' }, skip, take: pageSize }),
      prisma.product.count({ where: baseWhere }),
    ]);
    return { items, total, page, pageSize };
  }

  const like = `%${q}%`;
  const extraFilters = Prisma.sql`
    ${params.companyId ? Prisma.sql`AND p."companyId" = ${params.companyId}` : Prisma.empty}
    ${params.categoryId ? Prisma.sql`AND p."categoryId" = ${params.categoryId}` : Prisma.empty}
    ${params.isFastMoving ? Prisma.sql`AND p."isFastMoving" = true` : Prisma.empty}
    ${params.isFeatured ? Prisma.sql`AND p."isFeatured" = true` : Prisma.empty}
    ${params.onlyNew ? Prisma.sql`AND p."createdAt" >= ${thirtyDaysAgo}` : Prisma.empty}
  `;

  const matchClause = Prisma.sql`
    (
      p.name ILIKE ${like}
      OR coalesce(p.composition, '') ILIKE ${like}
      OR c.name ILIKE ${like}
      OR coalesce(p.sku, '') ILIKE ${like}
      OR coalesce(p."productCode", '') ILIKE ${like}
      OR similarity(p.name, ${q}) > 0.2
      OR similarity(coalesce(p.composition, ''), ${q}) > 0.2
      OR similarity(c.name, ${q}) > 0.2
    )
  `;

  const [ranked, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id
      FROM "Product" p
      JOIN "Company" c ON c.id = p."companyId"
      WHERE p."isActive" = true AND p."deletedAt" IS NULL ${extraFilters} AND ${matchClause}
      ORDER BY GREATEST(
        similarity(p.name, ${q}),
        similarity(coalesce(p.composition, ''), ${q}),
        similarity(c.name, ${q}),
        CASE WHEN p.name ILIKE ${like} THEN 0.6 ELSE 0 END
      ) DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM "Product" p
      JOIN "Company" c ON c.id = p."companyId"
      WHERE p."isActive" = true AND p."deletedAt" IS NULL ${extraFilters} AND ${matchClause}
    `,
  ]);

  const ids = ranked.map((r) => r.id);
  if (ids.length === 0) return { items: [], total: 0, page, pageSize };

  const records = await prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE });
  const byId = new Map(records.map((r) => [r.id, r]));
  const items = ids.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));

  return { items, total: Number(countRows[0]?.count ?? 0), page, pageSize };
}
