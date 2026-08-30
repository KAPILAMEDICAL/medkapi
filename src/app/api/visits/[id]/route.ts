import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  notes: z.string().trim().max(500).optional(),
  status: z.enum(['COMPLETED', 'SKIPPED']).default('COMPLETED'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  orderId: z.string().cuid().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    if (session.role !== 'SALES_BOY' && session.role !== 'SALES_MANAGER') {
      throw new ForbiddenError('Only sales staff can log visits.');
    }
    const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
    if (!salesman) throw new ForbiddenError('No sales profile found.');

    const { id } = await params;
    const existing = await prisma.visit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Visit not found.');
    if (existing.salesmanId !== salesman.id) throw new ForbiddenError('This is not your visit.');

    const body = schema.parse(await req.json());

    const visit = await prisma.$transaction(async (tx) => {
      const updated = await tx.visit.update({
        where: { id },
        data: {
          status: body.status,
          endedAt: new Date(),
          notes: body.notes,
          orderId: body.orderId,
          endLat: existing.locationConsent ? body.lat : undefined,
          endLng: existing.locationConsent ? body.lng : undefined,
        },
      });
      if (existing.tourStopId) {
        await tx.tourStop.update({ where: { id: existing.tourStopId }, data: { status: body.status } });
      }
      return updated;
    });

    await writeAuditLog({ actorUserId: session.userId, action: 'VISIT_FINISHED', entityType: 'Visit', entityId: id });

    return ok(visit);
  } catch (err) {
    return fail(err);
  }
}
