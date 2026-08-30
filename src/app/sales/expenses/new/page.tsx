'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Camera, PenLine, Sparkles, MapPin, X, ZoomIn, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface Category {
  id: string;
  name: string;
}

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

/**
 * Requests the browser's geolocation permission explicitly, on a user tap
 * — never automatically. If denied/unavailable, submission proceeds
 * without location; it is never a blocker (§10, same consent pattern as
 * TourStopCard's visit check-in).
 */
function getLocation(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true },
    );
  });
}

export default function NewExpensePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'bill' | 'manual' | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [billRequiredAbove, setBillRequiredAbove] = useState<number | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [billImageUrl, setBillImageUrl] = useState<string | undefined>();
  const [ocrRaw, setOcrRaw] = useState<{ text: string; confidence: number } | undefined>();
  const [ocrRunning, setOcrRunning] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [gstAmount, setGstAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');

  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'done' | 'unavailable'>('idle');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ isPossibleDuplicate: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/expenses/categories')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setCategories(json.data);
          if (json.data.length > 0) setCategoryId((cur) => cur || json.data[0].id);
        }
      });
    fetch('/api/expenses/policy')
      .then((r) => r.json())
      .then((json) => json.ok && setBillRequiredAbove(json.data.billRequiredAboveAmount));
  }, []);

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
        setOcrRaw({ text: ocr.rawText, confidence: ocr.confidence });
        if (ocr.fields.amount) setAmount(String(ocr.fields.amount));
        if (ocr.fields.date) setExpenseDate(ocr.fields.date);
        if (ocr.fields.merchant) setMerchant(ocr.fields.merchant);
        if (ocr.fields.invoiceNumber) setBillNumber(ocr.fields.invoiceNumber);
        if (ocr.fields.suggestedCategory) {
          const match = categories.find((c) => c.name.toUpperCase().replace(/[^A-Z]/g, '') === ocr.fields.suggestedCategory);
          if (match) setCategoryId(match.id);
        }
      }
    } finally {
      setOcrRunning(false);
    }
  }

  function removeBill() {
    setFile(null);
    setBillImageUrl(undefined);
    setOcrRaw(undefined);
  }

  async function captureLocation() {
    setLocationStatus('requesting');
    const loc = await getLocation();
    if (loc) {
      setLocation(loc);
      setLocationStatus('done');
    } else {
      setLocationStatus('unavailable');
    }
  }

  const billRequired = billRequiredAbove !== null && Number(amount || 0) > billRequiredAbove && !billImageUrl;

  async function submit() {
    setError(null);
    if (!categoryId) return setError('Please choose an expense category.');
    if (!amount || Number(amount) <= 0) return setError('Enter a valid amount.');
    if (billRequired) return setError(`A bill photo is required for expenses above ₹${billRequiredAbove} per company policy.`);

    setPending(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          amount: Number(amount),
          gstAmount: gstAmount ? Number(gstAmount) : undefined,
          expenseDate: new Date(expenseDate).toISOString(),
          merchant: merchant || undefined,
          billNumber: billNumber || undefined,
          paymentMode,
          description: description || undefined,
          remarks: remarks || undefined,
          billImageUrl,
          ocrRawText: ocrRaw?.text,
          ocrConfidence: ocrRaw?.confidence,
          ocrProvider: ocrRaw ? 'tesseract' : undefined,
          location: location ?? undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      setResult({ isPossibleDuplicate: json.data.isPossibleDuplicate });
      setTimeout(() => router.push('/sales/expenses'), json.data.isPossibleDuplicate ? 2500 : 1200);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-success/10 p-4 text-sm text-success">Expense submitted for approval.</div>
        {result.isPossibleDuplicate && (
          <div className="rounded-md bg-warning/10 p-4 text-sm text-warning">
            ⚠️ This looks similar to a bill you already submitted. It has been flagged for admin review.
          </div>
        )}
      </div>
    );
  }

  if (mode === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-ink">+ Add Expense</h1>
        <div className="grid grid-cols-1 gap-3">
          <button onClick={() => setMode('bill')} className="rounded-md border border-ink-faint/15 bg-surface p-6 text-center shadow-card hover:border-brand-300">
            <Camera size={32} className="mx-auto text-brand-600" />
            <p className="mt-2 text-base font-semibold text-ink">📷 Upload Bill</p>
            <p className="mt-1 text-xs text-ink-muted">Take a photo — we&apos;ll read the details for you to check.</p>
          </button>
          <button onClick={() => setMode('manual')} className="rounded-md border border-ink-faint/15 bg-surface p-6 text-center shadow-card hover:border-brand-300">
            <PenLine size={32} className="mx-auto text-brand-600" />
            <p className="mt-2 text-base font-semibold text-ink">✍️ Enter Manually</p>
            <p className="mt-1 text-xs text-ink-muted">No bill on hand? Type in the details yourself.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <button onClick={() => setMode(null)} className="flex items-center gap-1 text-sm text-ink-muted">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-lg font-semibold text-ink">{mode === 'bill' ? 'Upload Bill' : 'Enter Expense'}</h1>
      {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {mode === 'bill' && !billImageUrl && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="bill">
            Take bill photo
          </label>
          <input
            id="bill"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            capture="environment"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

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
          <p className="text-xs text-ink-muted">Please review and correct the fields below — AI extraction is not always perfect.</p>
        </div>
      )}

      {billImageUrl && (
        <Card className="flex items-center gap-3 p-3">
          <button onClick={() => setZoomOpen(true)} className="relative shrink-0">
            <Image src={billImageUrl} alt="Bill" width={64} height={64} className="h-16 w-16 rounded-sm object-cover" />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5 shadow-card">
              <ZoomIn size={12} className="text-ink-muted" />
            </span>
          </button>
          <div className="flex-1 text-xs text-ink-muted">{file?.name ?? 'Bill photo attached'}</div>
          <div className="flex gap-1.5">
            <label className="cursor-pointer rounded-md border border-ink-faint/40 px-2.5 py-1.5 text-xs">
              Replace
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            <button onClick={removeBill} className="rounded-md border border-danger/40 px-2 py-1.5 text-xs text-danger">
              <X size={14} />
            </button>
          </div>
        </Card>
      )}

      {mode === 'manual' && !billImageUrl && (
        <label className="block cursor-pointer rounded-md border border-dashed border-ink-faint/40 p-3 text-center text-xs text-ink-muted">
          + Attach a bill photo (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}

      {categories.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Category</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  categoryId === c.id ? 'border-brand-600 bg-brand-100 text-brand-700' : 'border-ink-faint/30 text-ink-muted'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input id="amount" label="Amount (₹)" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input id="date" label="Date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
      </div>
      {billRequired && (
        <p className="text-xs text-danger">A bill photo is required for expenses above ₹{billRequiredAbove} per company policy.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input id="gst" label="GST amount (optional)" type="number" inputMode="decimal" value={gstAmount} onChange={(e) => setGstAmount(e.target.value)} />
        <Select id="paymentMode" label="Payment Mode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {m.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input id="merchant" label="Vendor / merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        <Input id="billNumber" label="Bill number" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
      </div>

      <Textarea id="description" label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Textarea id="remarks" label="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

      <div>
        <Button variant="outline" size="sm" onClick={captureLocation} disabled={locationStatus === 'requesting'}>
          <MapPin size={16} /> {locationStatus === 'done' ? 'Location captured' : 'Capture my location (optional)'}
        </Button>
        {locationStatus === 'done' && location && (
          <p className="mt-1 text-xs text-ink-faint">
            📍 {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} (±{location.accuracy.toFixed(0)}m)
          </p>
        )}
        {locationStatus === 'unavailable' && <p className="mt-1 text-xs text-ink-faint">Location unavailable — submitting without it.</p>}
      </div>

      <Button fullWidth size="lg" disabled={pending || ocrRunning} onClick={submit}>
        {pending ? 'Submitting…' : 'Submit Expense'}
      </Button>

      {zoomOpen && billImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoomOpen(false)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setZoomOpen(false)}>
            <X size={28} />
          </button>
          <Image src={billImageUrl} alt="Bill (zoomed)" width={800} height={1000} className="max-h-full max-w-full rounded-md object-contain" />
        </div>
      )}
    </div>
  );
}
