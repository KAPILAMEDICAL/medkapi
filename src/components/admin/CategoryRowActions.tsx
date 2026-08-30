'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function CategoryRowActions({ categoryId, name, isActive }: { categoryId: string; name: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setPending(true);
    try {
      const res = await fetch(`/api/expenses/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  function rename() {
    const next = window.prompt('Rename category', name);
    if (next?.trim() && next.trim() !== name) patch({ name: next.trim() });
  }

  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="outline" disabled={pending} onClick={rename}>
        Rename
      </Button>
      <Button size="sm" variant={isActive ? 'outline' : 'primary'} disabled={pending} onClick={() => patch({ isActive: !isActive })}>
        {isActive ? 'Deactivate' : 'Activate'}
      </Button>
    </div>
  );
}
