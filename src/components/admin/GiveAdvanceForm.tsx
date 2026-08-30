'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';

export function GiveAdvanceForm({ salesmen }: { salesmen: { id: string; name: string }[] }) {
  const router = useRouter();
  const [salesmanId, setSalesmanId] = useState(salesmen[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!salesmanId || !amount || Number(amount) <= 0) return setError('Choose a salesman and enter a valid amount.');
    setPending(true);
    try {
      const res = await fetch('/api/expenses/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesmanId, amount: Number(amount), purpose: purpose || undefined }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      setAmount('');
      setPurpose('');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Select id="advance-salesman" label="Sales Boy" value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)}>
        {salesmen.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Input id="advance-amount" label="Amount (₹)" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input id="advance-purpose" label="Purpose (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      <div className="flex items-end">
        <Button fullWidth disabled={pending} onClick={submit}>
          {pending ? 'Giving…' : 'Give Advance'}
        </Button>
      </div>
      {error && <p className="text-xs text-danger sm:col-span-4">{error}</p>}
    </div>
  );
}
