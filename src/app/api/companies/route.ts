import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { UnauthorizedError, requireAdmin } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/audit';

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    const letter = req.nextUrl.searchParams.get('letter');
    const query = req.nextUrl.searchParams.get('query');

    const companies = await prisma.company.findMany({
      where: {
        isActive: true,
        ...(letter ? { name: { startsWith: letter, mode: 'insensitive' } } : {}),
        ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    });

    return ok(companies.map((c) => ({ ...c, productCount: c._count.products })));
  } catch (err) {
    return fail(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).optional(),
  contactInfo: z.string().trim().max(300).optional(),
  logoUrl: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const company = await prisma.company.create({
      data: { ...body, slug: slugify(body.name) },
    });
    await writeAuditLog({ actorUserId: session.userId, action: 'COMPANY_CREATED', entityType: 'Company', entityId: company.id });
    return ok(company, 201);
  } catch (err) {
    return fail(err);
  }
}
