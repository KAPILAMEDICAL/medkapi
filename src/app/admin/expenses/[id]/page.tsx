import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Printer } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { ZoomableImage } from '@/components/ui/ZoomableImage';
import { ExpenseReviewActions } from '@/components/admin/ExpenseReviewActions';
import { ReopenExpenseButton } from '@/components/admin/ReopenExpenseButton';

export default async function AdminExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentUser();

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      salesman: { select: { name: true, employeeCode: true, territory: true } },
      category: true,
      reviewedBy: { select: { name: true } },
      duplicateOf: { select: { id: true, amount: true, expenseDate: true, merchant: true } },
      settlement: { select: { id: true, periodStart: true, periodEnd: true } },
    },
  });
  if (!expense) notFound();

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${expense.salesman.name} · ${expense.category.name}`}
        description={`₹${Number(expense.amount).toFixed(2)} · ${expense.expenseDate.toDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={expense.status} kind="expense" />
            {(expense.status === 'APPROVED' || expense.status === 'REIMBURSED') && (
              <Link href={`/admin/expenses/${expense.id}/receipt`} target="_blank" className="flex items-center gap-1 text-sm text-brand-600">
                <Printer size={14} /> Receipt
              </Link>
            )}
          </div>
        }
      />

      {expense.isPossibleDuplicate && (
        <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
          ⚠️ Possible duplicate bill
          {expense.duplicateOf && (
            <>
              {' '}
              — matches a ₹{Number(expense.duplicateOf.amount).toFixed(2)} expense from {expense.duplicateOf.expenseDate.toDateString()} (
              <Link href={`/admin/expenses/${expense.duplicateOf.id}`} className="underline">
                view it
              </Link>
              ).
            </>
          )}{' '}
          Review carefully before approving.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {expense.billImageUrl ? (
            <Card className="p-3">
              <ZoomableImage src={expense.billImageUrl} alt="Bill" />
            </Card>
          ) : (
            <Card className="p-4 text-sm text-ink-faint">No bill photo attached.</Card>
          )}

          <Card className="space-y-2 p-4 text-sm">
            <Row label="Sales Boy" value={`${expense.salesman.name} (${expense.salesman.employeeCode})`} />
            <Row label="Territory" value={expense.salesman.territory ?? '—'} />
            <Row label="Category" value={expense.category.name} />
            <Row label="Amount" value={`₹${Number(expense.amount).toFixed(2)}`} />
            {expense.gstAmount && <Row label="GST" value={`₹${Number(expense.gstAmount).toFixed(2)}`} />}
            <Row label="Vendor" value={expense.merchant ?? '—'} />
            <Row label="Bill Number" value={expense.billNumber ?? '—'} />
            <Row label="Payment Mode" value={expense.paymentMode.replace(/_/g, ' ')} />
            <Row label="Description" value={expense.description ?? '—'} />
            <Row label="Remarks" value={expense.remarks ?? '—'} />
            <Row label="Submitted" value={expense.submittedAt.toLocaleString()} />
            {expense.editedAt && <Row label="Last edited" value={expense.editedAt.toLocaleString()} />}
            {expense.reviewedAt && <Row label="Reviewed" value={`${expense.reviewedBy?.name ?? '—'} · ${expense.reviewedAt.toLocaleString()}`} />}
            {expense.adminRemarks && <Row label="Admin remarks" value={expense.adminRemarks} />}
            {expense.reimbursedAt && <Row label="Reimbursed" value={expense.reimbursedAt.toLocaleString()} />}
            {expense.settlement && (
              <Row
                label="Settlement"
                value={
                  <Link href="/admin/expenses/settlements" className="text-brand-600 underline">
                    {expense.settlement.periodStart.toDateString()} – {expense.settlement.periodEnd.toDateString()}
                  </Link>
                }
              />
            )}
            {expense.latitude && expense.longitude && (
              <Row
                label="Location"
                value={
                  <a
                    className="flex items-center gap-1 text-brand-600"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps?q=${expense.latitude},${expense.longitude}`}
                  >
                    <MapPin size={14} /> {Number(expense.latitude).toFixed(5)}, {Number(expense.longitude).toFixed(5)}
                    {expense.locationAccuracy && ` (±${Number(expense.locationAccuracy).toFixed(0)}m)`}
                  </a>
                }
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold text-ink">Decision</p>
            {expense.isLocked ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <Badge tone="success">Locked</Badge> This record is locked against edits.
                </p>
                {session?.role === 'SUPER_ADMIN' && <ReopenExpenseButton expenseId={expense.id} />}
                {expense.status === 'APPROVED' && <ExpenseReviewActions expenseId={expense.id} status={expense.status} />}
              </div>
            ) : (
              <ExpenseReviewActions expenseId={expense.id} status={expense.status} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-faint/10 pb-1.5 last:border-0 last:pb-0">
      <span className="shrink-0 text-ink-faint">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
