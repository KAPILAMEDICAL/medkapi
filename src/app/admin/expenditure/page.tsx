import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ExpenseBarChart } from '@/components/admin/ExpenseBarChart';
import {
  getAdminExpenditureSummary,
  getExpenseByCategory,
  getExpenseByDay,
  getExpenseBySalesman,
  getExpenseByMonth,
  getSalesVsCollectionVsExpense,
} from '@/lib/expenditure-reports';

/** Admin Expenditure Control dashboard (§7/§14/§15). */
export default async function AdminExpenditurePage() {
  const [summary, byCategory, byDay, bySalesman, byMonth, salesVsCollectionVsExpense] = await Promise.all([
    getAdminExpenditureSummary(),
    getExpenseByCategory(),
    getExpenseByDay(),
    getExpenseBySalesman(),
    getExpenseByMonth(),
    getSalesVsCollectionVsExpense(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenditure Control"
        description="How much the team is spending, where, and how it compares to sales."
        actions={
          <Link href="/admin/expenses" className="text-sm font-medium text-brand-600">
            All Expenses →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total Team Expense" value={`₹${summary.totalTeamExpense.toFixed(0)}`} sublabel="This month" />
        <StatCard label="Pending Approval" value={`₹${summary.pendingApproval.toFixed(0)}`} tone="warning" />
        <StatCard label="Approved" value={`₹${summary.approved.toFixed(0)}`} tone="success" />
        <StatCard label="Reimbursement Due" value={`₹${summary.reimbursementDue.toFixed(0)}`} tone={summary.reimbursementDue > 0 ? 'danger' : 'neutral'} />
        <StatCard label="Advance Outstanding" value={`₹${summary.advanceOutstanding.toFixed(0)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales vs Collection vs Expenditure (this month)</CardTitle>
        </CardHeader>
        <CardBody>
          <ExpenseBarChart
            layout="horizontal"
            color="#2f7d68"
            data={[
              { label: 'Sales', total: salesVsCollectionVsExpense.sales },
              { label: 'Collection', total: salesVsCollectionVsExpense.collection },
              { label: 'Expenses', total: salesVsCollectionVsExpense.expense },
            ]}
          />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense by Category</CardTitle>
          </CardHeader>
          <CardBody>
            {byCategory.length === 0 ? (
              <p className="text-sm text-ink-faint">No expenses recorded this month yet.</p>
            ) : (
              <ExpenseBarChart layout="vertical" data={byCategory.map((c) => ({ label: c.name, total: c.total }))} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expense by Salesman</CardTitle>
          </CardHeader>
          <CardBody>
            {bySalesman.length === 0 ? (
              <p className="text-sm text-ink-faint">No expenses recorded this month yet.</p>
            ) : (
              <ExpenseBarChart layout="vertical" color="#c25b4a" data={bySalesman.map((s) => ({ label: s.name, total: s.total }))} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expense by Day (this month)</CardTitle>
          </CardHeader>
          <CardBody>
            {byDay.length === 0 ? (
              <p className="text-sm text-ink-faint">No expenses recorded this month yet.</p>
            ) : (
              <ExpenseBarChart data={byDay.map((d) => ({ label: d.date.slice(5), total: d.total }))} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expense by Month (trend)</CardTitle>
          </CardHeader>
          <CardBody>
            <ExpenseBarChart color="#2f7d68" data={byMonth.map((m) => ({ label: m.month, total: m.total }))} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salesman-wise Expenditure (this month)</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {summary.salesmanWise.length === 0 ? (
            <p className="text-sm text-ink-faint">No active salesmen.</p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="py-2">Sales Boy</th>
                  <th className="py-2 text-right">Sales</th>
                  <th className="py-2 text-right">Collection</th>
                  <th className="py-2 text-right">Expense</th>
                  <th className="py-2 text-right">Expense %</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.salesmanWise.map((s) => (
                  <tr key={s.salesmanId} className="border-t border-ink-faint/10">
                    <td className="py-2 font-medium text-ink">
                      <span className="flex items-center gap-1.5">
                        {s.name}
                        {summary.highestExpenseSalesman?.salesmanId === s.salesmanId && s.expense > 0 && (
                          <Badge tone="brand">Highest</Badge>
                        )}
                      </span>
                    </td>
                    <td className="py-2 text-right">₹{s.sales.toFixed(0)}</td>
                    <td className="py-2 text-right">₹{s.collection.toFixed(0)}</td>
                    <td className="py-2 text-right">₹{s.expense.toFixed(0)}</td>
                    <td className="py-2 text-right">{s.expensePercent.toFixed(2)}%</td>
                    <td className="py-2 text-right">
                      <Badge tone={s.status === 'GOOD' ? 'success' : 'warning'}>{s.status === 'GOOD' ? 'Good' : 'Review'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
