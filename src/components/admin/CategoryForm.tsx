'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** Admins add expense categories on the fly (§5) — never hard-deleted, only deactivated. */
export function CategoryForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setError(null);
    setPending(true);
    try {
      const code = name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const res = await fetch('/api/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), code }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      setName('');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Input id="new-category" label="New category name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Field Camp" />
      </div>
      <Button disabled={pending} onClick={submit}>
        {pending ? 'Adding…' : 'Add'}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
