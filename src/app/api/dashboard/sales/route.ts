import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session || (session.role !== 'SALES_BOY' && session.role !== 'SALES_MANAGER')) {
      throw new UnauthorizedError('Please log in as a sales team member.');
    }

    const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
    if (!salesman) throw new ForbiddenError('No sales profile found.');

    const today = startOfDay();
    const monthStart = startOfMonth();

    const [tour, todaysOrders, monthOrders, todaysCollection, monthCollection, pendingExpenses, assignedCustomerCount] =
      await Promise.all([
        prisma.tourSchedule.findUnique({
          where: { salesmanId_scheduleDate: { salesmanId: salesman.id, scheduleDate: today } },
          include: { stops: true },
        }),
        prisma.order.aggregate({
          where: { salesmanId: salesman.id, bookedAt: { gte: today } },
          _sum: { grandTotal: true },
          _count: true,
        }),
        prisma.order.aggregate({
          where: { salesmanId: salesman.id, bookedAt: { gte: monthStart } },
          _sum: { grandTotal: true },
        }),
        prisma.payment.aggregate({ where: { salesmanId: salesman.id, paidAt: { gte: today } }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { salesmanId: salesman.id, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.expense.count({ where: { salesmanId: salesman.id, status: { in: ['PENDING', 'CORRECTION_REQUESTED'] } } }),
        prisma.customer.count({ where: { assignedSalesmanId: salesman.id, status: 'APPROVED' } }),
      ]);

    const stops = tour?.stops ?? [];
    const completedVisits = stops.filter((s) => s.status === 'COMPLETED').length;
    const pendingVisits = stops.filter((s) => s.status === 'PLANNED').length;

    return ok({
      name: salesman.name,
      todaysDate: today,
      monthlySalesTarget: Number(salesman.monthlySalesTarget),
      monthlyCollectionTarget: Number(salesman.monthlyCollectionTarget),
      monthSales: Number(monthOrders._sum.grandTotal ?? 0),
      monthCollection: Number(monthCollection._sum.amount ?? 0),
      todaysOrderCount: todaysOrders._count,
      todaysOrderValue: Number(todaysOrders._sum.grandTotal ?? 0),
      todaysCollection: Number(todaysCollection._sum.amount ?? 0),
      totalStops: stops.length,
      completedVisits,
      pendingVisits,
      pendingExpenses,
      assignedCustomerCount,
    });
  } catch (err) {
    return fail(err);
  }
}
