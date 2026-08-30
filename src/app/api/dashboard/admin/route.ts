import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Powers the admin "what needs my attention today" dashboard (Master
 * Prompt §25/§59). Every number returned answers a concrete business
 * question — no vanity metrics.
 */
export async function GET() {
  try {
    await requireAdmin();
    const today = startOfDay();
    const monthStart = startOfMonth();

    const [
      todaySales,
      monthSales,
      todayCollection,
      monthCollection,
      ordersToday,
      activeCustomers,
      pendingApprovals,
      ordersAwaitingProcessing,
      expensesAwaitingApproval,
      lastLedgerPerCustomer,
      lowStockProducts,
    ] = await Promise.all([
      prisma.order.aggregate({ where: { bookedAt: { gte: today } }, _sum: { grandTotal: true } }),
      prisma.order.aggregate({ where: { bookedAt: { gte: monthStart } }, _sum: { grandTotal: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: today } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.order.count({ where: { bookedAt: { gte: today } } }),
      prisma.customer.count({ where: { status: 'APPROVED' } }),
      prisma.customer.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.order.count({ where: { status: { in: ['BOOKED', 'CONFIRMED'] } } }),
      prisma.expense.count({ where: { status: 'SUBMITTED' } }),
      // one row per customer, most recent ledger entry, to sum total outstanding
      prisma.$queryRaw<{ balance: number }[]>`
        SELECT DISTINCT ON ("customerId") "balanceAfter"::float AS balance
        FROM "LedgerEntry"
        ORDER BY "customerId", "entryDate" DESC
      `,
      prisma.product.count({ where: { isActive: true, stockQty: { lte: 10 } } }),
    ]);

    const totalOutstanding = lastLedgerPerCustomer.reduce((sum, r) => sum + Number(r.balance), 0);

    const priorities: { label: string; count: number; href: string }[] = [];
    if (pendingApprovals > 0) priorities.push({ label: 'customer registrations awaiting approval', count: pendingApprovals, href: '/admin/customers?status=PENDING_APPROVAL' });
    if (ordersAwaitingProcessing > 0) priorities.push({ label: 'orders awaiting processing', count: ordersAwaitingProcessing, href: '/admin/orders?status=BOOKED' });
    if (expensesAwaitingApproval > 0) priorities.push({ label: 'expenses awaiting approval', count: expensesAwaitingApproval, href: '/admin/expenses?status=SUBMITTED' });
    if (lowStockProducts > 0) priorities.push({ label: 'products low on stock', count: lowStockProducts, href: '/admin/products?lowStock=true' });

    return ok({
      todaySales: Number(todaySales._sum.grandTotal ?? 0),
      monthSales: Number(monthSales._sum.grandTotal ?? 0),
      todayCollection: Number(todayCollection._sum.amount ?? 0),
      monthCollection: Number(monthCollection._sum.amount ?? 0),
      totalOutstanding,
      ordersToday,
      activeCustomers,
      priorities,
    });
  } catch (err) {
    return fail(err);
  }
}
