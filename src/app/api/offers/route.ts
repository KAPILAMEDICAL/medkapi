import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { UnauthorizedError, requireAdmin } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { notifyUsers } from '@/lib/notifications';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    const now = new Date();
    const offers = await prisma.offer.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        ...(session.role === 'CUSTOMER' ? { visibleToCustomers: true } : { visibleToSales: true }),
      },
      include: { product: { include: { company: true } }, company: true },
      orderBy: { startDate: 'desc' },
    });

    return ok(offers);
  } catch (err) {
    return fail(err);
  }
}

const createSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(1000).optional(),
  posterUrl: z.string().trim().optional(),
  schemeText: z.string().trim().max(100).optional(),
  productId: z.string().cuid().optional(),
  companyId: z.string().cuid().optional(),
  minQty: z.number().int().positive().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  visibleToCustomers: z.boolean().default(true),
  visibleToSales: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const offer = await prisma.offer.create({
      data: { ...body, startDate: new Date(body.startDate), endDate: new Date(body.endDate) },
    });
    await writeAuditLog({ actorUserId: session.userId, action: 'OFFER_CREATED', entityType: 'Offer', entityId: offer.id });

    if (body.visibleToCustomers) {
      const customers = await prisma.customer.findMany({ where: { status: 'APPROVED' }, select: { userId: true } });
      await notifyUsers(customers.map((c) => c.userId), {
        type: 'NEW_OFFER',
        title: 'New offer available',
        body: offer.title,
        linkUrl: '/customer/offers',
      });
    }

    return ok(offer, 201);
  } catch (err) {
    return fail(err);
  }
}
