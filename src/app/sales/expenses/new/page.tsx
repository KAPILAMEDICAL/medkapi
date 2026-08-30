'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';

const CATEGORIES = ['PETROL', 'TRAVEL', 'FOOD', 'ACCOMMODATION', 'AUTO_TAXI', 'PARKING', 'COURIER', 'BUSINESS', 'OTHER'];

export default function NewExpensePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [billImageUrl, setBillImageUrl] = useState<string | undefined>();
  const [ocrRaw, setOcrRaw] = useState<{ text: string; confidence: number; provider: string } | undefined>();
  const [ocrRunning, setOcrRunning] = useState(false);

  const [category, setCategory] = useState('PETROL');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleFile(f: File) {
    setFile(f);
    setOcrRunning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('file', f);
      const res = await fetch('/api/expenses/ocr', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setBillImageUrl(json.data.billImageUrl);
      if (json.data.ocr) {
        const ocr = json.data.ocr;
        setOcrRaw({ text: ocr.rawText, confidence: ocr.confidence, provider: ocr.provider });
        if (ocr.fields.amount) setAmount(String(ocr.fields.amount));
        if (ocr.fields.date) setExpenseDate(ocr.fields.date);
        if (ocr.fields.merchant) setMerchant(ocr.fields.merchant);
        if (ocr.fields.suggestedCategory) setCategory(ocr.fields.suggestedCategory);
      }
    } finally {
      setOcrRunning(false);
    }
  }

  async function submit() {
    setError(null);
    if (!amount || Number(amount) <= 0) return setError('Enter a valid amount.');
    setPending(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          amount: Number(amount),
          expenseDate: new Date(expenseDate).toISOString(),
          merchant: merchant || undefined,
          description: description || undefined,
          billImageUrl,
          ocrRawText: ocrRaw?.text,
          ocrConfidence: ocrRaw?.confidence,
          ocrProvider: ocrRaw?.provider,
        }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      setSuccess(true);
      setTimeout(() => router.push('/sales/expenses'), 1000);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return <div className="rounded-md bg-success/10 p-4 text-sm text-success">Expense submitted for approval.</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">Upload Bill / Expense</h1>
      {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="bill">
          Bill / receipt photo
        </label>
        <input
          id="bill"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          capture="environment"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {file && !ocrRunning && <p className="mt-1 text-xs text-ink-faint">{file.name} uploaded</p>}
      </div>

      {ocrRunning && (
        <div className="flex items-center gap-2 rounded-md bg-info/10 p-3 text-sm text-info">
          <Sparkles size={16} /> Reading bill with AI…
        </div>
      )}

      {ocrRaw && !ocrRunning && (
        <div className="rounded-md border border-info/30 bg-info/5 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-info">
            <Sparkles size={14} /> AI Extracted Information (confidence {ocrRaw.confidence.toFixed(0)}%)
          </p>
          <p className="text-xs text-ink-muted">Please review and correct the fields below before submitting — AI extraction is not always perfect.</p>
        </div>
      )}

      <Select id="category" label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.replace(/_/g, ' ')}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <Input id="amount" label="Amount (₹)" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input id="date" label="Date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
      </div>

      <Input id="merchant" label="Merchant / vendor (optional)" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      <Textarea id="description" label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

      <Button fullWidth size="lg" disabled={pending || ocrRunning} onClick={submit}>
        {pending ? 'Submitting…' : 'Submit Expense'}
      </Button>
    </div>
  );
}
