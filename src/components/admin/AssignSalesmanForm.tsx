'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function AssignSalesmanForm({
  customerId,
  currentSalesmanId,
  salesmen,
}: {
  customerId: string;
  currentSalesmanId: string | null;
  salesmen: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentSalesmanId ?? '');
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ASSIGN_SALESMAN', assignedSalesmanId: value || undefined }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Select id="salesman" label="" value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">Unassigned</option>
        {salesmen.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Button size="sm" fullWidth disabled={pending} onClick={save}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
