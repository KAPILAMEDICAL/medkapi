'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';

interface Customer {
  id: string;
  firmName: string;
  mobile: string;
}

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-faint">Loading…</p>}>
      <NewPaymentInner />
    </Suspense>
  );
}

function NewPaymentInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(params.get('customerId') ?? '');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeBank, setChequeBank] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch('/api/customers')
      .then((r) => r.json())
      .then((json) => json.ok && setCustomers(json.data));
  }, []);

  async function submit() {
    setError(null);
    if (!customerId) return setError('Please select a customer.');
    if (!amount || Number(amount) <= 0) return setError('Enter a valid amount.');
    setPending(true);
    try {
      let receiptImageUrl: string | undefined;
      if (receiptFile) {
        const fd = new FormData();
        fd.set('file', receiptFile);
        const uploadRes = await fetch('/api/uploads?category=receipts', { method: 'POST', body: fd });
        const uploadJson = await uploadRes.json();
        if (!uploadJson.ok) return setError(uploadJson.error);
        receiptImageUrl = uploadJson.data.url;
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          amount: Number(amount),
          mode,
          referenceNumber: referenceNumber || undefined,
          chequeNumber: mode === 'CHEQUE' ? chequeNumber : undefined,
          chequeBank: mode === 'CHEQUE' ? chequeBank : undefined,
          chequeDate: mode === 'CHEQUE' && chequeDate ? new Date(chequeDate).toISOString() : undefined,
          remarks: remarks || undefined,
          receiptImageUrl,
        }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      setSuccess(`Payment receipt ${json.data.paymentNumber} generated.`);
      setTimeout(() => router.push('/sales/payments'), 1200);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return <div className="rounded-md bg-success/10 p-4 text-sm text-success">{success}</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">Payment Received</h1>
      {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <Select id="customer" label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        <option value="">Select a customer…</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.firmName} ({c.mobile})
          </option>
        ))}
      </Select>

      <Input id="amount" label="Amount (₹)" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <Select id="mode" label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="CASH">Cash</option>
        <option value="UPI">UPI</option>
        <option value="BANK_TRANSFER">Bank Transfer</option>
        <option value="CHEQUE">Cheque</option>
        <option value="OTHER">Other</option>
      </Select>

      {mode !== 'CASH' && mode !== 'CHEQUE' && (
        <Input id="ref" label="Transaction / reference number" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
      )}

      {mode === 'CHEQUE' && (
        <div className="grid grid-cols-2 gap-3">
          <Input id="chequeNumber" label="Cheque number" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
          <Input id="chequeBank" label="Bank" value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} />
          <Input id="chequeDate" label="Cheque date" type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="receipt">
          Photo (optional)
        </label>
        <input id="receipt" type="file" accept="image/jpeg,image/png,application/pdf" capture="environment" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
      </div>

      <Textarea id="remarks" label="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

      <Button fullWidth size="lg" disabled={pending} onClick={submit}>
        {pending ? 'Submitting…' : 'Submit Payment'}
      </Button>
    </div>
  );
}
