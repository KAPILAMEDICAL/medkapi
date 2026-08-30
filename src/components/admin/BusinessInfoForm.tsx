'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface BusinessInfo {
  name: string;
  tagline: string;
  address: string;
  gstDefaultPercent: number;
}

export function BusinessInfoForm({ initial }: { initial: BusinessInfo }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setPending(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'business.info', value: values }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input id="bizName" label="Business name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
      <Input id="bizTagline" label="Tagline" value={values.tagline} onChange={(e) => setValues({ ...values, tagline: e.target.value })} />
      <Input id="bizAddress" label="Address" value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} />
      <Input
        id="bizGst"
        label="Default GST %"
        type="number"
        value={values.gstDefaultPercent}
        onChange={(e) => setValues({ ...values, gstDefaultPercent: Number(e.target.value) })}
      />
      <Button disabled={pending} onClick={save}>
        {pending ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
      </Button>
    </div>
  );
}
