import { notFound } from 'next/navigation';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { ExpenseCorrectionForm } from '@/components/sales/ExpenseCorrectionForm';

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const expense = await prisma.expense.findFirst({
    where: { id, salesmanId: salesman.id },
    include: { category: true, reviewedBy: { select: { name: true } }, duplicateOf: { select: { amount: true, expenseDate: true, merchant: true } } },
  });
  if (!expense) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{expense.category.name}</h1>
        <StatusBadge status={expense.status} kind="expense" />
      </div>

      {expense.billImageUrl && (
        <Card className="p-3">
          <Image src={expense.billImageUrl} alt="Bill" width={600} height={400} className="w-full rounded-sm object-contain" />
        </Card>
      )}

      <Card className="space-y-2 p-4 text-sm">
        <Row label="Amount" value={`₹${Number(expense.amount).toFixed(2)}`} />
        {expense.gstAmount && <Row label="GST" value={`₹${Number(expense.gstAmount).toFixed(2)}`} />}
        <Row label="Date" value={expense.expenseDate.toDateString()} />
        <Row label="Vendor" value={expense.merchant ?? '—'} />
        <Row label="Bill Number" value={expense.billNumber ?? '—'} />
        <Row label="Payment Mode" value={expense.paymentMode.replace(/_/g, ' ')} />
        {expense.description && <Row label="Description" value={expense.description} />}
        {expense.remarks && <Row label="Remarks" value={expense.remarks} />}
        <Row label="Submitted" value={expense.submittedAt.toLocaleString()} />
        {expense.reviewedAt && <Row label={`${expense.status === 'REJECTED' ? 'Rejected' : 'Reviewed'} by`} value={`${expense.reviewedBy?.name ?? '—'} on ${expense.reviewedAt.toDateString()}`} />}
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
                <MapPin size={14} /> View on map
              </a>
            }
          />
        )}
      </Card>

      {expense.isPossibleDuplicate && (
        <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
          ⚠️ Flagged as a possible duplicate
          {expense.duplicateOf && ` of a ₹${Number(expense.duplicateOf.amount).toFixed(2)} expense from ${expense.duplicateOf.expenseDate.toDateString()}`}.
          Under admin review.
        </div>
      )}

      {expense.status === 'REJECTED' && expense.adminRemarks && (
        <div className="rounded-md bg-danger/10 p-3 text-sm text-danger">Rejected: {expense.adminRemarks}</div>
      )}

      {expense.status === 'CORRECTION_REQUESTED' && (
        <div className="space-y-3">
          <div className="rounded-md bg-info/10 p-3 text-sm text-info">Correction requested: {expense.adminRemarks}</div>
          <ExpenseCorrectionForm
            expenseId={expense.id}
            initial={{
              amount: Number(expense.amount),
              merchant: expense.merchant ?? '',
              billNumber: expense.billNumber ?? '',
              description: expense.description ?? '',
              remarks: expense.remarks ?? '',
            }}
          />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-faint/10 pb-1.5 last:border-0 last:pb-0">
      <span className="text-ink-faint">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
