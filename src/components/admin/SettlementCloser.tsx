'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';

function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

interface Preview {
  openingAdvance: number;
  newAdvance: number;
  approvedExpenses: number;
  closingBalance: number;
  direction: 'AMOUNT_TO_RETURN' | 'AMOUNT_TO_REIMBURSE' | 'SETTLED';
}

const DIRECTION_LABEL: Record<Preview['direction'], string> = {
  AMOUNT_TO_RETURN: 'Amount to be returned by the salesman',
  AMOUNT_TO_REIMBURSE: 'Additional reimbursement due to the salesman',
  SETTLED: 'Fully settled — nothing owed either way',
};

export function SettlementCloser({ salesmen }: { salesmen: { id: string; name: string }[] }) {
  const router = useRouter();
  const defaults = defaultPeriod();
  const [salesmanId, setSalesmanId] = useState(salesmen[0]?.id ?? '');
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salesmanId || !periodStart || !periodEnd) return;
    setLoadingPreview(true);
    setError(null);
    const params = new URLSearchParams({ salesmanId, previewFrom: new Date(periodStart).toISOString(), previewTo: new Date(periodEnd).toISOString() });
    fetch(`/api/expenses/settlements?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setPreview(json.data.preview);
      })
      .finally(() => setLoadingPreview(false));
  }, [salesmanId, periodStart, periodEnd]);

  async function close() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/expenses/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesmanId,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd).toISOString(),
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      setNotes('');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select id="settle-salesman" label="Sales Boy" value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)}>
          {salesmen.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input id="settle-start" label="Period Start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        <Input id="settle-end" label="Period End" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
      </div>

      {loadingPreview && <p className="text-xs text-ink-faint">Calculating…</p>}
      {preview && !loadingPreview && (
        <div className="rounded-md border border-ink-faint/15 bg-surface-subtle p-3 text-sm">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <span>Opening Advance: <strong>₹{preview.openingAdvance.toFixed(2)}</strong></span>
            <span>New Advance: <strong>₹{preview.newAdvance.toFixed(2)}</strong></span>
            <span>Approved Expenses: <strong>₹{preview.approvedExpenses.toFixed(2)}</strong></span>
            <span>Closing Balance: <strong>₹{preview.closingBalance.toFixed(2)}</strong></span>
          </div>
          <p className="mt-2 font-medium text-ink">{DIRECTION_LABEL[preview.direction]}</p>
        </div>
      )}

      <Textarea id="settle-notes" label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button disabled={pending || !preview} onClick={close}>
        {pending ? 'Closing…' : 'Close Settlement'}
      </Button>
    </div>
  );
}
