'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';

/** Lets a salesman fix and resubmit an expense the admin sent back with REQUEST CORRECTION (§9). */
export function ExpenseCorrectionForm({
  expenseId,
  initial,
}: {
  expenseId: string;
  initial: { amount: number; merchant: string; billNumber: string; description: string; remarks: string };
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(initial.amount));
  const [merchant, setMerchant] = useState(initial.merchant);
  const [billNumber, setBillNumber] = useState(initial.billNumber);
  const [description, setDescription] = useState(initial.description);
  const [remarks, setRemarks] = useState(initial.remarks);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resubmit() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          merchant: merchant || undefined,
          billNumber: billNumber || undefined,
          description: description || undefined,
          remarks: remarks || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.push('/sales/expenses');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-ink-faint/15 bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Fix and resubmit</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Input id="c-amount" label="Amount (₹)" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input id="c-merchant" label="Vendor" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      <Input id="c-bill" label="Bill number" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
      <Textarea id="c-desc" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Textarea id="c-remarks" label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      <Button fullWidth disabled={pending} onClick={resubmit}>
        {pending ? 'Resubmitting…' : 'Resubmit for Approval'}
      </Button>
    </div>
  );
}
