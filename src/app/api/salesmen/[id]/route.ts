import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, NotFoundError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  territory: z.string().trim().max(100).optional(),
  monthlySalesTarget: z.number().nonnegative().optional(),
  monthlyCollectionTarget: z.number().nonnegative().optional(),
  managerUserId: z.string().cuid().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.salesman.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Salesman not found.');

    const updated = await prisma.salesman.update({ where: { id }, data: body });
    await writeAuditLog({ actorUserId: session.userId, action: 'SALESMAN_UPDATED', entityType: 'Salesman', entityId: id, metadata: body });
    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
