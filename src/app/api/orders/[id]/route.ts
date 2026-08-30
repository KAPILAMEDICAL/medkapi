import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError, isAdminRole } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { notifyUser } from '@/lib/notifications';

async function loadOrderForViewer(id: string, session: { userId: string; role: string }) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      salesman: { select: { name: true, mobile: true } },
      items: { include: { product: { select: { name: true, packSize: true, imageUrl: true } } } },
    },
  });
  if (!order) throw new NotFoundError('Order not found.');

  if (session.role === 'CUSTOMER' && order.customer.userId !== session.userId) {
    throw new ForbiddenError('You cannot view this order.');
  }
  if (session.role === 'SALES_BOY') {
    const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
    if (!salesman || order.salesmanId !== salesman.id) throw new ForbiddenError('You cannot view this order.');
  }
  return order;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    const { id } = await params;
    const order = await loadOrderForViewer(id, session);
    return ok(order);
  } catch (err) {
    return fail(err);
  }
}

const ORDER_TRANSITIONS: Record<string, string[]> = {
  BOOKED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'RETURNED'],
};

const patchSchema = z.object({
  status: z.enum(['CONFIRMED', 'PROCESSING', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED']),
  cancelReason: z.string().trim().max(300).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session || !isAdminRole(session.role)) throw new ForbiddenError('Only admin staff can update order status.');

    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.order.findUnique({ where: { id }, include: { customer: true } });
    if (!existing) throw new NotFoundError('Order not found.');

    const allowed = ORDER_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(body.status)) {
      throw new ForbiddenError(`Cannot move an order from ${existing.status} to ${body.status}.`);
    }

    const timestampField =
      body.status === 'CONFIRMED'
        ? 'confirmedAt'
        : body.status === 'DISPATCHED'
          ? 'dispatchedAt'
          : body.status === 'DELIVERED'
            ? 'deliveredAt'
            : body.status === 'CANCELLED'
              ? 'cancelledAt'
              : undefined;

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: body.status,
        cancelReason: body.status === 'CANCELLED' ? body.cancelReason : undefined,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
    });

    await writeAuditLog({
      actorUserId: session.userId,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'Order',
      entityId: id,
      metadata: { from: existing.status, to: body.status },
    });

    await notifyUser(existing.customer.userId, {
      type: 'ORDER_STATUS',
      title: `Order ${existing.orderNumber} ${body.status.toLowerCase()}`,
      body: `Your order status has been updated to ${body.status.replace(/_/g, ' ')}.`,
      linkUrl: `/customer/orders/${id}`,
    });

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
