'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';

export function FinishVisitButton({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);

  async function finish() {
    setPending(true);
    try {
      const res = await fetch(`/api/visits/${visitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', notes: notes || undefined }),
      });
      const json = await res.json();
      if (json.ok) router.push('/sales/tour');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea id="visit-notes" label="Visit notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button fullWidth size="lg" disabled={pending} onClick={finish}>
        {pending ? 'Finishing…' : 'Finish Visit'}
      </Button>
    </div>
  );
}
