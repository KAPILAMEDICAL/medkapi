import { prisma } from '@/lib/db';
import { getMonthlyLimitFor, getHighValueThreshold, getReviewThresholdPercent, getBillRequiredAboveAmount } from '@/lib/expenses';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { ExpenseLimitsForm } from '@/components/admin/ExpenseLimitsForm';
import { SalesmanLimitOverride } from '@/components/admin/SalesmanLimitOverride';

/** Admin-configurable expense limits (§8). */
export default async function AdminExpenseLimitsPage() {
  const [monthlyLimitDefault, highValueThreshold, reviewThresholdPercent, billRequiredAboveAmount, salesmen] = await Promise.all([
    getMonthlyLimitFor('__default__'), // no such salesman → falls through to the global Setting
    getHighValueThreshold(),
    getReviewThresholdPercent(),
    getBillRequiredAboveAmount(),
    prisma.salesman.findMany({ where: { isActive: true }, select: { id: true, name: true, monthlyExpenseLimit: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Expense Limits" description="Set the company-wide default, or override it for an individual salesman." />

      <Card>
        <CardHeader>
          <CardTitle>Global Policy</CardTitle>
        </CardHeader>
        <CardBody>
          <ExpenseLimitsForm initial={{ monthlyLimitDefault, highValueThreshold, reviewThresholdPercent, billRequiredAboveAmount }} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-Salesman Override</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {salesmen.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-ink-faint/10 py-2 last:border-0">
              <span className="text-sm text-ink">{s.name}</span>
              <SalesmanLimitOverride salesmanId={s.id} current={s.monthlyExpenseLimit ? Number(s.monthlyExpenseLimit) : null} />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
