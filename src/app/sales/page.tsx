import Link from 'next/link';
import { ClipboardList, IndianRupee, MapPin, Receipt, Users, Tag } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { StatCard } from '@/components/ui/StatCard';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function SalesHomePage() {
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const today = startOfDay();
  const monthStart = startOfMonth();

  const [tour, monthOrders, monthCollection, pendingExpenses] = await Promise.all([
    prisma.tourSchedule.findUnique({
      where: { salesmanId_scheduleDate: { salesmanId: salesman.id, scheduleDate: today } },
      include: { stops: true },
    }),
    prisma.order.aggregate({ where: { salesmanId: salesman.id, bookedAt: { gte: monthStart } }, _sum: { grandTotal: true } }),
    prisma.payment.aggregate({ where: { salesmanId: salesman.id, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.expense.count({ where: { salesmanId: salesman.id, status: 'SUBMITTED' } }),
  ]);

  const stops = tour?.stops ?? [];
  const completed = stops.filter((s) => s.status === 'COMPLETED').length;
  const pending = stops.filter((s) => s.status === 'PLANNED').length;
  const salesAchievement = Math.min(
    100,
    Math.round((Number(monthOrders._sum.grandTotal ?? 0) / Math.max(1, Number(salesman.monthlySalesTarget))) * 100),
  );
  const collectionAchievement = Math.min(
    100,
    Math.round((Number(monthCollection._sum.amount ?? 0) / Math.max(1, Number(salesman.monthlyCollectionTarget))) * 100),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Hello, {salesman.name}</h1>
        <p className="text-sm text-ink-muted">{today.toDateString()} · {salesman.territory}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Customers Today" value={String(stops.length)} sublabel={`${completed} done · ${pending} pending`} />
        <StatCard label="Pending Expenses" value={String(pendingExpenses)} tone={pendingExpenses > 0 ? 'warning' : 'neutral'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ProgressCard label="Sales Target (Month)" percent={salesAchievement} value={`₹${Number(monthOrders._sum.grandTotal ?? 0).toFixed(0)} / ₹${Number(salesman.monthlySalesTarget).toFixed(0)}`} />
        <ProgressCard label="Collection Target (Month)" percent={collectionAchievement} value={`₹${Number(monthCollection._sum.amount ?? 0).toFixed(0)} / ₹${Number(salesman.monthlyCollectionTarget).toFixed(0)}`} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionButton href="/sales/tour" icon={MapPin} label="Today's Tour" />
          <ActionButton href="/sales/customers" icon={Users} label="Customers" />
          <ActionButton href="/sales/orders/new" icon={ClipboardList} label="Book Order" />
          <ActionButton href="/sales/payments/new" icon={IndianRupee} label="Payment Received" />
          <ActionButton href="/sales/expenses/new" icon={Receipt} label="Upload Bill / Expense" />
          <ActionButton href="/sales/offers" icon={Tag} label="Offers" />
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ label, percent, value }: { label: string; percent: number; value: string }) {
  return (
    <div className="rounded-md border border-ink-faint/15 bg-surface p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full bg-brand-600" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">{value} ({percent}%)</p>
    </div>
  );
}

function ActionButton({ href, icon: Icon, label }: { href: string; icon: typeof MapPin; label: string }) {
  return (
    <Link href={href}>
      <div className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-md border border-ink-faint/15 bg-surface p-3 text-center shadow-card hover:border-brand-300">
        <Icon size={22} className="text-brand-600" />
        <span className="text-xs font-medium text-ink">{label}</span>
      </div>
    </Link>
  );
}
