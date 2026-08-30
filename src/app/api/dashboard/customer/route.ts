import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'CUSTOMER') throw new UnauthorizedError('Please log in as a customer.');

    const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
    if (!customer) throw new ForbiddenError('No customer profile found.');

    const [lastLedger, recentOrders, pendingOrderCount, activeOfferCount, newProductCount, notificationCount] = await Promise.all([
      prisma.ledgerEntry.findFirst({ where: { customerId: customer.id }, orderBy: { entryDate: 'desc' } }),
      prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { bookedAt: 'desc' }, take: 5 }),
      prisma.order.count({ where: { customerId: customer.id, status: { in: ['BOOKED', 'CONFIRMED', 'PROCESSING', 'PACKED'] } } }),
      prisma.offer.count({
        where: { isActive: true, visibleToCustomers: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
      }),
      prisma.product.count({ where: { isActive: true, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
    ]);

    return ok({
      firmName: customer.firmName,
      outstanding: lastLedger ? Number(lastLedger.balanceAfter) : 0,
      recentOrders,
      pendingOrderCount,
      activeOfferCount,
      newProductCount,
      unreadNotifications: notificationCount,
    });
  } catch (err) {
    return fail(err);
  }
}
