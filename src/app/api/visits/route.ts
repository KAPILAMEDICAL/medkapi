import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  customerId: z.string().cuid(),
  tourStopId: z.string().cuid().optional(),
  locationConsent: z.boolean().default(false),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

/**
 * Starts a field visit. Location is recorded ONLY when
 * `locationConsent: true` and coordinates are supplied by the client
 * after the browser/device permission prompt — never collected without
 * that explicit consent (Master Prompt §16).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    if (session.role !== 'SALES_BOY' && session.role !== 'SALES_MANAGER') {
      throw new ForbiddenError('Only sales staff can log visits.');
    }
    const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
    if (!salesman) throw new ForbiddenError('No sales profile found.');

    const body = schema.parse(await req.json());

    const visit = await prisma.$transaction(async (tx) => {
      const created = await tx.visit.create({
        data: {
          salesmanId: salesman.id,
          customerId: body.customerId,
          tourStopId: body.tourStopId,
          status: 'IN_PROGRESS',
          locationConsent: body.locationConsent,
          startLat: body.locationConsent ? body.lat : undefined,
          startLng: body.locationConsent ? body.lng : undefined,
        },
      });
      if (body.tourStopId) {
        await tx.tourStop.update({ where: { id: body.tourStopId }, data: { status: 'IN_PROGRESS' } });
      }
      return created;
    });

    await writeAuditLog({ actorUserId: session.userId, action: 'VISIT_STARTED', entityType: 'Visit', entityId: visit.id });

    return ok(visit, 201);
  } catch (err) {
    return fail(err);
  }
}
