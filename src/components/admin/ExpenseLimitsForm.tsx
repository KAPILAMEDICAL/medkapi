'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Limits {
  monthlyLimitDefault: number;
  highValueThreshold: number;
  reviewThresholdPercent: number;
  billRequiredAboveAmount: number;
}

/** Admin-configurable expense policy defaults (§8/§21). */
export function ExpenseLimitsForm({ initial }: { initial: Limits }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setPending(true);
    setSaved(false);
    try {
      await Promise.all([
        fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'expense.monthlyLimitDefault', value: values.monthlyLimitDefault }),
        }),
        fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'expense.highValueThreshold', value: values.highValueThreshold }),
        }),
        fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'expense.reviewThresholdPercent', value: values.reviewThresholdPercent }),
        }),
        fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'expense.billRequiredAboveAmount', value: values.billRequiredAboveAmount }),
        }),
      ]);
      setSaved(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input
        id="monthlyLimitDefault"
        label="Default monthly expense limit (₹)"
        type="number"
        value={values.monthlyLimitDefault}
        onChange={(e) => setValues({ ...values, monthlyLimitDefault: Number(e.target.value) })}
        hint="Used for any salesman without a personal override below."
      />
      <Input
        id="highValueThreshold"
        label="High-value expense alert threshold (₹)"
        type="number"
        value={values.highValueThreshold}
        onChange={(e) => setValues({ ...values, highValueThreshold: Number(e.target.value) })}
        hint="Admins are notified whenever a single expense is at or above this amount."
      />
      <Input
        id="reviewThresholdPercent"
        label="Expense-to-sales review threshold (%)"
        type="number"
        value={values.reviewThresholdPercent}
        onChange={(e) => setValues({ ...values, reviewThresholdPercent: Number(e.target.value) })}
        hint="A salesman above this expense-to-sales ratio is flagged 'Review' on the expenditure dashboard."
      />
      <Input
        id="billRequiredAboveAmount"
        label="Bill photo required above (₹)"
        type="number"
        value={values.billRequiredAboveAmount}
        onChange={(e) => setValues({ ...values, billRequiredAboveAmount: Number(e.target.value) })}
        hint="Manual entries above this amount must attach a bill photo."
      />
      <Button disabled={pending} onClick={save}>
        {pending ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
      </Button>
    </div>
  );
}
