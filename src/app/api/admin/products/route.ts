import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  companyId: z.string().cuid(),
  divisionId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  composition: z.string().trim().max(300).optional(),
  packSize: z.string().trim().max(50).optional(),
  sku: z.string().trim().max(50).optional(),
  productCode: z.string().trim().max(50).optional(),
  mrp: z.number().positive(),
  ptr: z.number().positive().optional(),
  pts: z.number().positive().optional(),
  gstPercent: z.number().min(0).max(28),
  stockQty: z.number().int().min(0),
  minOrderQty: z.number().int().positive(),
  isFastMoving: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = schema.parse(await req.json());

    const product = await prisma.product.create({
      data: { ...body, slug: `${slugify(body.name)}-${Date.now().toString(36)}` },
    });

    await writeAuditLog({ actorUserId: session.userId, action: 'PRODUCT_CREATED', entityType: 'Product', entityId: product.id });
    return ok(product, 201);
  } catch (err) {
    return fail(err);
  }
}
