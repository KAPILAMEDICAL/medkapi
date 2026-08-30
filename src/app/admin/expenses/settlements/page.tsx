import { prisma } from '@/lib/db';
import { listSettlements } from '@/lib/expense-advances';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SettlementCloser } from '@/components/admin/SettlementCloser';

const DIRECTION_LABEL: Record<string, string> = {
  AMOUNT_TO_RETURN: 'Amount to Return',
  AMOUNT_TO_REIMBURSE: 'Amount to Reimburse',
  SETTLED: 'Settled',
};

/** Month-end (or custom period) settlement (§13). */
export default async function AdminSettlementsPage() {
  const [salesmen, settlements] = await Promise.all([
    prisma.salesman.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    listSettlements(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Expense Settlement" description="Reconcile advances against approved expenses for a period." />

      <Card>
        <CardHeader>
          <CardTitle>Close a Settlement</CardTitle>
        </CardHeader>
        <CardBody>
          <SettlementCloser salesmen={salesmen} />
        </CardBody>
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Settlement History</p>
        {settlements.length === 0 ? (
          <EmptyState title="No settlements closed yet." />
        ) : (
          <div className="space-y-2">
            {settlements.map((s) => (
              <Card key={s.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">
                    {s.salesman.name} · {s.periodStart.toDateString()} – {s.periodEnd.toDateString()}
                  </p>
                  <Badge tone={s.direction === 'AMOUNT_TO_REIMBURSE' ? 'success' : s.direction === 'AMOUNT_TO_RETURN' ? 'warning' : 'neutral'}>
                    {DIRECTION_LABEL[s.direction]}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-ink-muted sm:grid-cols-4">
                  <span>Opening: ₹{Number(s.openingAdvance).toFixed(2)}</span>
                  <span>New Advance: ₹{Number(s.newAdvance).toFixed(2)}</span>
                  <span>Approved: ₹{Number(s.approvedExpenses).toFixed(2)}</span>
                  <span className="font-medium text-ink">Closing: ₹{Number(s.closingBalance).toFixed(2)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-faint">Settled by {s.settledBy.name} on {s.settledAt.toDateString()}{s.notes && ` · ${s.notes}`}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
