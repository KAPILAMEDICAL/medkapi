import { notFound } from 'next/navigation';
import Image from 'next/image';
import { prisma } from '@/lib/db';
import { PrintButton } from '@/components/admin/PrintButton';

/** Professional expense record generated after approval (§19). */
export default async function ExpenseReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { salesman: { select: { name: true, employeeCode: true } }, category: true, reviewedBy: { select: { name: true } } },
  });
  if (!expense || (expense.status !== 'APPROVED' && expense.status !== 'REIMBURSED')) notFound();

  return (
    <div className="mx-auto max-w-xl bg-white p-8 text-black print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-sm text-ink-muted">Print or save this page as a PDF.</p>
        <PrintButton />
      </div>

      <div className="border border-black/20 p-6">
        <div className="mb-4 border-b border-black/20 pb-3 text-center">
          <p className="text-lg font-bold tracking-wide">KAPILA MEDICAL AGENCIES</p>
          <p className="text-sm">SIRSI</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-black/60">Expense Record</p>
        </div>

        <table className="w-full text-sm">
          <tbody>
            <ReceiptRow label="Sales Boy" value={`${expense.salesman.name} (${expense.salesman.employeeCode})`} />
            <ReceiptRow label="Expense ID" value={expense.id} />
            <ReceiptRow label="Date" value={expense.expenseDate.toDateString()} />
            <ReceiptRow label="Category" value={expense.category.name} />
            <ReceiptRow label="Vendor" value={expense.merchant ?? '—'} />
            <ReceiptRow label="Bill Number" value={expense.billNumber ?? '—'} />
            <ReceiptRow label="Amount" value={`₹${Number(expense.amount).toFixed(2)}`} />
            <ReceiptRow label="Payment Mode" value={expense.paymentMode.replace(/_/g, ' ')} />
            <ReceiptRow label="Approval Status" value={expense.status} />
            <ReceiptRow label="Approved By" value={expense.reviewedBy?.name ?? '—'} />
            <ReceiptRow label="Approval Date" value={expense.reviewedAt?.toDateString() ?? '—'} />
          </tbody>
        </table>

        {expense.billImageUrl && (
          <div className="mt-4 border-t border-black/20 pt-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-black/60">Bill Reference</p>
            <Image src={expense.billImageUrl} alt="Bill" width={400} height={300} className="max-h-64 w-auto object-contain" />
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-black/10">
      <td className="py-1.5 pr-4 font-medium text-black/70">{label}</td>
      <td className="py-1.5 text-right">{value}</td>
    </tr>
  );
}
