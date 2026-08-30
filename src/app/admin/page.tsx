import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { SalesTrendChart } from '@/components/admin/SalesTrendChart';
import { CompanySalesChart } from '@/components/admin/CompanySalesChart';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function AdminDashboardPage() {
  const today = startOfDay();
  const monthStart = startOfMonth();
  const fourteenDaysAgo = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);

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
    lowStockProducts,
    recentOrders,
    trendOrders,
    companySalesRaw,
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
    prisma.product.count({ where: { isActive: true, stockQty: { lte: 10 } } }),
    prisma.order.findMany({ orderBy: { bookedAt: 'desc' }, take: 6, include: { customer: { select: { firmName: true } } } }),
    prisma.order.findMany({ where: { bookedAt: { gte: fourteenDaysAgo } }, select: { bookedAt: true, grandTotal: true } }),
    prisma.$queryRaw<{ company: string; sales: number }[]>`
      SELECT c.name as company, SUM(oi."lineTotal")::float as sales
      FROM "OrderItem" oi
      JOIN "Product" p ON p.id = oi."productId"
      JOIN "Company" c ON c.id = p."companyId"
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."bookedAt" >= ${monthStart}
      GROUP BY c.name
      ORDER BY sales DESC
      LIMIT 8
    `,
  ]);

  const totalOutstandingRows = await prisma.$queryRaw<{ balance: number }[]>`
    SELECT DISTINCT ON ("customerId") "balanceAfter"::float AS balance
    FROM "LedgerEntry"
    ORDER BY "customerId", "entryDate" DESC
  `;
  const totalOutstanding = totalOutstandingRows.reduce((s, r) => s + Number(r.balance), 0);

  const trendMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    trendMap.set(d.toDateString(), 0);
  }
  for (const o of trendOrders) {
    const key = o.bookedAt.toDateString();
    trendMap.set(key, (trendMap.get(key) ?? 0) + Number(o.grandTotal));
  }
  const trendData = Array.from(trendMap.entries()).map(([day, sales]) => ({
    day: day.slice(4, 10),
    sales: Math.round(sales),
  }));

  const priorities: { label: string; count: number; href: string }[] = [];
  if (pendingApprovals > 0) priorities.push({ label: 'customer registrations awaiting approval', count: pendingApprovals, href: '/admin/customers?status=PENDING_APPROVAL' });
  if (ordersAwaitingProcessing > 0) priorities.push({ label: 'orders awaiting processing', count: ordersAwaitingProcessing, href: '/admin/orders?status=BOOKED' });
  if (expensesAwaitingApproval > 0) priorities.push({ label: 'expenses awaiting approval', count: expensesAwaitingApproval, href: '/admin/expenses?status=SUBMITTED' });
  if (lowStockProducts > 0) priorities.push({ label: 'products low on stock', count: lowStockProducts, href: '/admin/products?lowStock=true' });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Today's Sales" value={`₹${Number(todaySales._sum.grandTotal ?? 0).toFixed(0)}`} />
        <StatCard label="Month's Sales" value={`₹${Number(monthSales._sum.grandTotal ?? 0).toFixed(0)}`} />
        <StatCard label="Today's Collection" value={`₹${Number(todayCollection._sum.amount ?? 0).toFixed(0)}`} tone="success" />
        <StatCard label="Month's Collection" value={`₹${Number(monthCollection._sum.amount ?? 0).toFixed(0)}`} tone="success" />
        <StatCard label="Total Outstanding" value={`₹${totalOutstanding.toFixed(0)}`} tone={totalOutstanding > 0 ? 'warning' : 'success'} />
        <StatCard label="Orders Today" value={String(ordersToday)} />
        <StatCard label="Active Customers" value={String(activeCustomers)} />
        <StatCard label="Low Stock Items" value={String(lowStockProducts)} tone={lowStockProducts > 0 ? 'danger' : 'neutral'} />
      </div>

      {priorities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What needs your attention today</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {priorities.map((p) => (
              <Link key={p.href} href={p.href} className="flex items-center gap-2 rounded-md bg-warning/10 p-2.5 text-sm text-warning hover:bg-warning/20">
                <AlertTriangle size={16} />
                <strong>{p.count}</strong> {p.label}
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend (14 days)</CardTitle>
          </CardHeader>
          <CardBody>
            <SalesTrendChart data={trendData} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Company-wise Sales (this month)</CardTitle>
          </CardHeader>
          <CardBody>
            {companySalesRaw.length === 0 ? (
              <p className="text-sm text-ink-faint">No sales recorded this month yet.</p>
            ) : (
              <CompanySalesChart data={companySalesRaw.map((c) => ({ company: c.company, sales: Number(c.sales) }))} />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {recentOrders.map((o) => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between rounded-md p-2 hover:bg-surface-subtle">
              <span className="text-sm text-ink">{o.orderNumber} · {o.customer.firmName}</span>
              <span className="text-sm font-medium text-ink">₹{Number(o.grandTotal).toFixed(2)}</span>
            </Link>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
