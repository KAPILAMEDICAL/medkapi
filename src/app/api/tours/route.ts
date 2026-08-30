import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError, requireAdmin } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { notifyUser } from '@/lib/notifications';
import { getEnrichedTour, startOfDay } from '@/lib/tours';

function parseDate(value: string | null): Date {
  return startOfDay(value ? new Date(value) : new Date());
}

/** Today's (or a given date's) tour for the logged-in salesman, or — for admins — for a named salesman. */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    const params = req.nextUrl.searchParams;
    const scheduleDate = parseDate(params.get('date'));

    let salesmanId = params.get('salesmanId');
    if (session.role === 'SALES_BOY' || session.role === 'SALES_MANAGER') {
      const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
      if (!salesman) throw new ForbiddenError('No sales profile found.');
      salesmanId = salesman.id;
    } else if (!salesmanId) {
      throw new ForbiddenError('salesmanId is required.');
    }

    const result = await getEnrichedTour(salesmanId, scheduleDate);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

const createSchema = z.object({
  salesmanId: z.string().cuid(),
  scheduleDate: z.string().datetime(),
  stops: z
    .array(
      z.object({
        customerId: z.string().cuid(),
        plannedTime: z.string().max(10).optional(),
        objective: z.string().max(200).optional(),
      }),
    )
    .min(1, 'Add at least one customer to the tour.'),
});

/** Admin/sales-manager creates or replaces a salesman's tour schedule for a date. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const scheduleDate = new Date(body.scheduleDate);
    scheduleDate.setHours(0, 0, 0, 0);

    const tour = await prisma.$transaction(async (tx) => {
      const existing = await tx.tourSchedule.findUnique({
        where: { salesmanId_scheduleDate: { salesmanId: body.salesmanId, scheduleDate } },
      });
      if (existing) await tx.tourStop.deleteMany({ where: { tourScheduleId: existing.id } });

      const schedule =
        existing ??
        (await tx.tourSchedule.create({
          data: { salesmanId: body.salesmanId, scheduleDate, createdByUserId: session.userId },
        }));

      await tx.tourStop.createMany({
        data: body.stops.map((s, i) => ({
          tourScheduleId: schedule.id,
          customerId: s.customerId,
          sequence: i + 1,
          plannedTime: s.plannedTime,
          objective: s.objective,
        })),
      });

      return schedule;
    });

    await writeAuditLog({ actorUserId: session.userId, action: 'TOUR_SCHEDULED', entityType: 'TourSchedule', entityId: tour.id });

    const salesman = await prisma.salesman.findUnique({ where: { id: body.salesmanId } });
    if (salesman) {
      await notifyUser(salesman.userId, {
        type: 'TOUR_SCHEDULED',
        title: "Today's tour is ready",
        body: `Your tour for ${scheduleDate.toDateString()} has ${body.stops.length} stop(s).`,
        linkUrl: '/sales/tour',
      });
    }

    return ok({ tourId: tour.id }, 201);
  } catch (err) {
    return fail(err);
  }
}
