import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';

export default async function SalesProfilePage() {
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId }, include: { manager: true } });
  if (!salesman) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">My Profile</h1>
      <Card className="space-y-1 p-4 text-sm">
        <Row label="Name" value={salesman.name} />
        <Row label="Employee Code" value={salesman.employeeCode} />
        <Row label="Mobile" value={salesman.mobile} />
        <Row label="Territory" value={salesman.territory ?? '—'} />
        <Row label="Reports To" value={salesman.manager?.name ?? '—'} />
        <Row label="Monthly Sales Target" value={`₹${Number(salesman.monthlySalesTarget).toFixed(2)}`} />
        <Row label="Monthly Collection Target" value={`₹${Number(salesman.monthlyCollectionTarget).toFixed(2)}`} />
        <Row label="Status" value={salesman.isActive ? 'Active' : 'Inactive'} />
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-ink-faint/10 py-1.5 last:border-0">
      <span className="text-ink-faint">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
