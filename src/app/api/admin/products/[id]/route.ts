import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, NotFoundError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';

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
  isFastMoving: z.boolean(),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product not found.');
    return ok(product);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = schema.parse(await req.json());

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Product not found.');

    const priceChanged = Number(existing.mrp) !== body.mrp || Number(existing.ptr ?? 0) !== (body.ptr ?? 0);

    const updated = await prisma.product.update({ where: { id }, data: body });

    await writeAuditLog({
      actorUserId: session.userId,
      action: priceChanged ? 'PRODUCT_PRICE_CHANGED' : 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: id,
      metadata: priceChanged ? { oldMrp: Number(existing.mrp), newMrp: body.mrp } : undefined,
    });

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
