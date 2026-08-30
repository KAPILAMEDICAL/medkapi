'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function NewSalesmanPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [territory, setTerritory] = useState('');
  const [monthlySalesTarget, setMonthlySalesTarget] = useState('');
  const [monthlyCollectionTarget, setMonthlyCollectionTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/salesmen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          mobile,
          employeeCode,
          territory: territory || undefined,
          monthlySalesTarget: monthlySalesTarget ? Number(monthlySalesTarget) : 0,
          monthlyCollectionTarget: monthlyCollectionTarget ? Number(monthlyCollectionTarget) : 0,
        }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.push('/admin/sales-team');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Add Salesman" />
      <Card>
        <CardBody className="space-y-4">
          {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}
          <Input id="name" label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input id="mobile" label="Mobile number" value={mobile} onChange={(e) => setMobile(e.target.value)} required />
            <Input id="employeeCode" label="Employee code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required />
          </div>
          <Input id="territory" label="Territory (optional)" value={territory} onChange={(e) => setTerritory(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="salesTarget" label="Monthly sales target (₹)" type="number" value={monthlySalesTarget} onChange={(e) => setMonthlySalesTarget(e.target.value)} />
            <Input id="collectionTarget" label="Monthly collection target (₹)" type="number" value={monthlyCollectionTarget} onChange={(e) => setMonthlyCollectionTarget(e.target.value)} />
          </div>
          <Button disabled={pending || !name || !mobile || !employeeCode} onClick={submit}>
            {pending ? 'Saving…' : 'Create Salesman'}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
