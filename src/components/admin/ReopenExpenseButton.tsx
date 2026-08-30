'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

/**
 * §22: an approved/reimbursed expense is locked; only a super admin can
 * reopen it, and only with a stated reason (fully audited).
 */
export function ReopenExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    const reason = window.prompt('Why are you reopening this locked record? (recorded in the audit log)');
    if (!reason?.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REOPEN', reason }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" disabled={pending} onClick={reopen}>
        {pending ? 'Reopening…' : 'Reopen this record'}
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
