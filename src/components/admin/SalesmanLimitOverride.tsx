'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function SalesmanLimitOverride({ salesmanId, current }: { salesmanId: string; current: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current !== null ? String(current) : '');
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const res = await fetch(`/api/salesmen/${salesmanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyExpenseLimit: value === '' ? null : Number(value) }),
      });
      const json = await res.json();
      if (json.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        placeholder="Use default"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-28 rounded-md border border-ink-faint/40 bg-surface px-2 py-1 text-sm"
      />
      <Button size="sm" variant="outline" disabled={pending} onClick={save}>
        {pending ? '…' : 'Save'}
      </Button>
    </div>
  );
}
