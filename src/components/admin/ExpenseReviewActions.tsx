'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';

/** Admin decision panel: approve / reject / request correction (§9), plus reimburse. */
export function ExpenseReviewActions({ expenseId, status }: { expenseId: string; status: string }) {
  const router = useRouter();
  const [remarks, setRemarks] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED') {
    if (decision !== 'APPROVED' && !remarks.trim()) {
      setError('Please enter a reason first.');
      return;
    }
    setError(null);
    setPending(decision);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, adminRemarks: remarks || undefined }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function reimburse() {
    setPending('REIMBURSE');
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REIMBURSE' }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (status === 'APPROVED') {
    return (
      <div className="space-y-2">
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button fullWidth disabled={!!pending} onClick={reimburse}>
          {pending === 'REIMBURSE' ? 'Marking…' : 'Mark Reimbursed'}
        </Button>
      </div>
    );
  }

  if (status === 'REJECTED' || status === 'REIMBURSED') return null;

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-danger">{error}</p>}
      <Textarea
        id="admin-remarks"
        label="Reason (required for reject / request correction)"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!!pending} onClick={() => decide('APPROVED')}>
          {pending === 'APPROVED' ? 'Approving…' : 'Approve'}
        </Button>
        <Button variant="outline" disabled={!!pending} onClick={() => decide('CORRECTION_REQUESTED')}>
          {pending === 'CORRECTION_REQUESTED' ? 'Sending…' : 'Request Correction'}
        </Button>
        <Button variant="danger" disabled={!!pending} onClick={() => decide('REJECTED')}>
          {pending === 'REJECTED' ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
    </div>
  );
}
