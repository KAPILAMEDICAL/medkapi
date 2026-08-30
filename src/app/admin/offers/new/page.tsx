'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function NewOfferPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [schemeText, setSchemeText] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [minQty, setMinQty] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [visibleToCustomers, setVisibleToCustomers] = useState(true);
  const [visibleToSales, setVisibleToSales] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch('/api/companies')
      .then((r) => r.json())
      .then((json) => json.ok && setCompanies(json.data));
  }, []);

  async function submit() {
    setError(null);
    if (!endDate) return setError('Please set an end date.');
    setPending(true);
    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || undefined,
          schemeText: schemeText || undefined,
          companyId: companyId || undefined,
          minQty: minQty ? Number(minQty) : undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          visibleToCustomers,
          visibleToSales,
        }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.push('/admin/offers');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Create Offer" />
      <Card>
        <CardBody className="space-y-4">
          {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}
          <Input id="title" label="Offer title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Textarea id="description" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input id="schemeText" label="Scheme (e.g. Buy 5 Get 1 Free)" value={schemeText} onChange={(e) => setSchemeText(e.target.value)} />
          <Select id="companyId" label="Company (optional)" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input id="minQty" label="Minimum quantity (optional)" type="number" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="startDate" label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input id="endDate" label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={visibleToCustomers} onChange={(e) => setVisibleToCustomers(e.target.checked)} /> Visible to customers
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={visibleToSales} onChange={(e) => setVisibleToSales(e.target.checked)} /> Visible to sales team
            </label>
          </div>
          <Button disabled={pending || !title} onClick={submit}>
            {pending ? 'Saving…' : 'Create Offer'}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
