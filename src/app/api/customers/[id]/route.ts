import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError, requireAdmin } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { notifyUser } from '@/lib/notifications';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { assignedSalesman: true, notes: { orderBy: { createdAt: 'desc' } } },
    });
    if (!customer) throw new NotFoundError('Customer not found.');

    if (session.role === 'CUSTOMER' && customer.userId !== session.userId) {
      throw new ForbiddenError('You cannot view this customer.');
    }
    if (session.role === 'SALES_BOY') {
      const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
      if (!salesman || customer.assignedSalesmanId !== salesman.id) throw new ForbiddenError('Not your customer.');
    }

    return ok(customer);
  } catch (err) {
    return fail(err);
  }
}

const patchSchema = z.object({
  action: z.enum(['APPROVE', 'DISABLE', 'REJECT', 'REACTIVATE', 'UPDATE', 'ASSIGN_SALESMAN']),
  assignedSalesmanId: z.string().cuid().optional(),
  priceVisibility: z.enum(['MRP_ONLY', 'MRP_AND_PTR', 'ALL_PRICES']).optional(),
  creditLimit: z.number().nonnegative().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Customer not found.');

    const data: Record<string, unknown> = {};
    switch (body.action) {
      case 'APPROVE':
        data.status = 'APPROVED';
        data.approvedByUserId = session.userId;
        data.approvedAt = new Date();
        break;
      case 'DISABLE':
        data.status = 'DISABLED';
        break;
      case 'REJECT':
        data.status = 'REJECTED';
        break;
      case 'REACTIVATE':
        data.status = 'APPROVED';
        break;
      case 'ASSIGN_SALESMAN':
        data.assignedSalesmanId = body.assignedSalesmanId;
        break;
      case 'UPDATE':
        if (body.priceVisibility) data.priceVisibility = body.priceVisibility;
        if (body.creditLimit !== undefined) data.creditLimit = body.creditLimit;
        break;
    }

    const updated = await prisma.customer.update({ where: { id }, data });

    await writeAuditLog({
      actorUserId: session.userId,
      action: `CUSTOMER_${body.action}`,
      entityType: 'Customer',
      entityId: id,
      metadata: body,
    });

    if (body.action === 'APPROVE') {
      await notifyUser(existing.userId, {
        type: 'ACCOUNT_APPROVED',
        title: 'Your account is now active',
        body: 'Your registration has been approved. You can now log in and place orders.',
        linkUrl: '/login/customer',
      });
    }

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
