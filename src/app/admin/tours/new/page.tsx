'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Salesman {
  id: string;
  name: string;
}
interface Customer {
  id: string;
  firmName: string;
}
interface Stop {
  customerId: string;
  plannedTime: string;
  objective: string;
}

export default function NewTourPage() {
  const router = useRouter();
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesmanId, setSalesmanId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [stops, setStops] = useState<Stop[]>([{ customerId: '', plannedTime: '', objective: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch('/api/salesmen')
      .then((r) => r.json())
      .then((json) => json.ok && setSalesmen(json.data));
  }, []);

  useEffect(() => {
    if (!salesmanId) return;
    fetch(`/api/customers?salesmanId=${salesmanId}&status=APPROVED`)
      .then((r) => r.json())
      .then((json) => json.ok && setCustomers(json.data));
  }, [salesmanId]);

  function updateStop(i: number, patch: Partial<Stop>) {
    setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function submit() {
    setError(null);
    if (!salesmanId) return setError('Select a salesman.');
    const validStops = stops.filter((s) => s.customerId);
    if (validStops.length === 0) return setError('Add at least one customer stop.');
    setPending(true);
    try {
      const res = await fetch('/api/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesmanId,
          scheduleDate: new Date(date).toISOString(),
          stops: validStops.map((s) => ({ customerId: s.customerId, plannedTime: s.plannedTime || undefined, objective: s.objective || undefined })),
        }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.push('/admin/tours');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Create Tour Schedule" />
      <Card>
        <CardBody className="space-y-4">
          {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Select id="salesman" label="Salesman" value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)}>
              <option value="">Select salesman…</option>
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input id="date" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-ink">Customer Stops</p>
            {stops.map((stop, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_1fr_auto] items-end gap-2">
                <Select id={`customer-${i}`} label={i === 0 ? 'Customer' : ''} value={stop.customerId} onChange={(e) => updateStop(i, { customerId: e.target.value })}>
                  <option value="">Select…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firmName}
                    </option>
                  ))}
                </Select>
                <Input id={`time-${i}`} label={i === 0 ? 'Time' : ''} placeholder="09:00" value={stop.plannedTime} onChange={(e) => updateStop(i, { plannedTime: e.target.value })} />
                <Input id={`objective-${i}`} label={i === 0 ? 'Objective' : ''} value={stop.objective} onChange={(e) => updateStop(i, { objective: e.target.value })} />
                <button
                  type="button"
                  className="mb-0.5 flex h-[42px] w-9 items-center justify-center text-ink-faint hover:text-danger"
                  onClick={() => setStops((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setStops((prev) => [...prev, { customerId: '', plannedTime: '', objective: '' }])}>
              <Plus size={14} /> Add Stop
            </Button>
          </div>

          <Button disabled={pending} onClick={submit}>
            {pending ? 'Saving…' : 'Create Tour'}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
