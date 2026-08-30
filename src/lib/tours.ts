import { prisma } from '@/lib/db';

export function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Loads a salesman's tour for a given date with each stop enriched with
 * last-order / last-payment / outstanding context, so the visit screen
 * has everything needed in one read (Master Prompt §15).
 */
export async function getEnrichedTour(salesmanId: string, scheduleDate: Date) {
  const tour = await prisma.tourSchedule.findUnique({
    where: { salesmanId_scheduleDate: { salesmanId, scheduleDate } },
    include: { stops: { orderBy: { sequence: 'asc' }, include: { customer: true, visit: true } } },
  });
  if (!tour) return { scheduleDate, stops: [] as never[] };

  const stops = await Promise.all(
    tour.stops.map(async (stop) => {
      const [lastOrder, lastPayment, lastLedger] = await Promise.all([
        prisma.order.findFirst({ where: { customerId: stop.customerId }, orderBy: { bookedAt: 'desc' } }),
        prisma.payment.findFirst({ where: { customerId: stop.customerId }, orderBy: { paidAt: 'desc' } }),
        prisma.ledgerEntry.findFirst({ where: { customerId: stop.customerId }, orderBy: { entryDate: 'desc' } }),
      ]);
      return {
        ...stop,
        context: {
          lastOrderAt: lastOrder?.bookedAt ?? null,
          lastOrderAmount: lastOrder ? Number(lastOrder.grandTotal) : null,
          lastPaymentAt: lastPayment?.paidAt ?? null,
          lastPaymentAmount: lastPayment ? Number(lastPayment.amount) : null,
          outstanding: lastLedger ? Number(lastLedger.balanceAfter) : 0,
        },
      };
    }),
  );

  return { id: tour.id, scheduleDate: tour.scheduleDate, stops };
}
