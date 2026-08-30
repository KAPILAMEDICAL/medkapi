import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, NotFoundError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { notifyUser } from '@/lib/notifications';

const patchSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'CLEARED', 'BOUNCED']),
});

/** Admin verifies, rejects, or (for cheques) marks a payment cleared/bounced. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.payment.findUnique({ where: { id }, include: { customer: true } });
    if (!existing) throw new NotFoundError('Payment not found.');

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: body.status,
        verifiedByUserId: session.userId,
        verifiedAt: new Date(),
      },
    });

    await writeAuditLog({
      actorUserId: session.userId,
      action: 'PAYMENT_STATUS_CHANGED',
      entityType: 'Payment',
      entityId: id,
      metadata: { from: existing.status, to: body.status },
    });

    await notifyUser(existing.customer.userId, {
      type: 'PAYMENT_STATUS',
      title: `Payment ${body.status.toLowerCase()}`,
      body: `Your payment ${existing.paymentNumber} of ₹${Number(existing.amount).toFixed(2)} is now ${body.status.toLowerCase()}.`,
      linkUrl: '/customer/account',
    });

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
