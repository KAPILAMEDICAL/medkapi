import { prisma } from '@/lib/db';
import { listAdvances, getOpenBalance } from '@/lib/expense-advances';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { GiveAdvanceForm } from '@/components/admin/GiveAdvanceForm';

/** Travel advances given to the sales team (§12). */
export default async function AdminAdvancesPage() {
  const [salesmen, advances] = await Promise.all([
    prisma.salesman.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    listAdvances(),
  ]);

  const balances = await Promise.all(salesmen.map(async (s) => ({ ...s, balance: await getOpenBalance(s.id) })));

  return (
    <div className="space-y-4">
      <PageHeader title="Travel Advances" description="Give a field advance and track what each salesman is currently holding." />

      <Card>
        <CardHeader>
          <CardTitle>Give Advance</CardTitle>
        </CardHeader>
        <CardBody>
          <GiveAdvanceForm salesmen={salesmen} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Balances</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {balances.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-ink-faint/10 py-1.5 last:border-0">
              <span className="text-sm text-ink">{s.name}</span>
              <span className={`text-sm font-medium ${s.balance >= 0 ? 'text-ink' : 'text-success'}`}>
                {s.balance >= 0 ? `Holding ₹${s.balance.toFixed(2)}` : `₹${Math.abs(s.balance).toFixed(2)} reimbursement due`}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Advance History</p>
        {advances.length === 0 ? (
          <EmptyState title="No advances given yet." />
        ) : (
          <div className="space-y-2">
            {advances.map((a) => (
              <Card key={a.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{a.salesman.name} · ₹{Number(a.amount).toFixed(2)}</p>
                  <p className="text-xs text-ink-faint">{a.purpose ?? 'Travel advance'} · given by {a.givenBy.name} on {a.givenAt.toDateString()}</p>
                </div>
                {a.settlementId && <Badge tone="neutral">Settled</Badge>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
