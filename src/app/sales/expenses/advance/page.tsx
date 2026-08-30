import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { getOpenBalance, listAdvances, listSettlements } from '@/lib/expense-advances';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

const DIRECTION_LABEL: Record<string, string> = {
  AMOUNT_TO_RETURN: 'Amount to Return',
  AMOUNT_TO_REIMBURSE: 'Amount to Reimburse',
  SETTLED: 'Settled',
};

export default async function AdvanceSettlementPage() {
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const [balance, advances, settlements] = await Promise.all([
    getOpenBalance(salesman.id),
    listAdvances(salesman.id),
    listSettlements(salesman.id),
  ]);

  const advanceGiven = advances.filter((a) => !a.settlementId).reduce((sum, a) => sum + Number(a.amount), 0);
  const expensesAgainstIt = advanceGiven - balance;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">Travel Advance & Settlement</h1>

      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Current Cycle</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-ink-faint">Advance received</p>
            <p className="text-base font-semibold text-ink">₹{advanceGiven.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-ink-faint">Expenses submitted</p>
            <p className="text-base font-semibold text-ink">₹{Math.max(0, expensesAgainstIt).toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-3 border-t border-ink-faint/10 pt-3">
          <p className="text-ink-faint">{balance >= 0 ? 'Balance you are holding' : 'Additional reimbursement due to you'}</p>
          <p className={`text-xl font-semibold ${balance >= 0 ? 'text-ink' : 'text-success'}`}>₹{Math.abs(balance).toFixed(2)}</p>
        </div>
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Advances Received</p>
        {advances.length === 0 ? (
          <EmptyState title="No advances recorded yet." />
        ) : (
          <div className="space-y-2">
            {advances.map((a) => (
              <Card key={a.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-ink">₹{Number(a.amount).toFixed(2)}</p>
                  <p className="text-xs text-ink-faint">{a.purpose ?? 'Travel advance'} · {a.givenAt.toDateString()}</p>
                </div>
                {a.settlementId && <Badge tone="neutral">Settled</Badge>}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Settlement History</p>
        {settlements.length === 0 ? (
          <EmptyState title="No settlements yet." description="Month-end settlements will appear here once your admin closes a period." />
        ) : (
          <div className="space-y-2">
            {settlements.map((s) => (
              <Card key={s.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ink-faint">
                    {s.periodStart.toDateString()} – {s.periodEnd.toDateString()}
                  </p>
                  <Badge tone={s.direction === 'AMOUNT_TO_REIMBURSE' ? 'success' : s.direction === 'AMOUNT_TO_RETURN' ? 'warning' : 'neutral'}>
                    {DIRECTION_LABEL[s.direction]}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-ink-muted">
                  <span>Opening Advance: ₹{Number(s.openingAdvance).toFixed(2)}</span>
                  <span>New Advance: ₹{Number(s.newAdvance).toFixed(2)}</span>
                  <span>Approved Expenses: ₹{Number(s.approvedExpenses).toFixed(2)}</span>
                  <span className="font-medium text-ink">Closing: ₹{Number(s.closingBalance).toFixed(2)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
