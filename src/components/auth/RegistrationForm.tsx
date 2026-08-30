'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';

const initial = {
  firmName: '',
  ownerName: '',
  mobile: '',
  whatsapp: '',
  email: '',
  address: '',
  area: '',
  city: '',
  pincode: '',
  gstNumber: '',
  drugLicenceNo: '',
  customerType: 'PHARMACY',
};

export function RegistrationForm() {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof typeof initial>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setSuccess(json.data.message);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 p-4 text-sm text-success">{success}</div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <Input id="firmName" label="Firm name" required value={form.firmName} onChange={(e) => set('firmName', e.target.value)} />
      <Input id="ownerName" label="Owner / contact person" required value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input id="mobile" label="Mobile number" required inputMode="numeric" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        <Input id="whatsapp" label="WhatsApp (optional)" inputMode="numeric" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
      </div>
      <Input id="email" label="Email (optional)" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      <Input id="address" label="Address" required value={form.address} onChange={(e) => set('address', e.target.value)} />
      <div className="grid grid-cols-3 gap-3">
        <Input id="area" label="Area" value={form.area} onChange={(e) => set('area', e.target.value)} />
        <Input id="city" label="City" required value={form.city} onChange={(e) => set('city', e.target.value)} />
        <Input id="pincode" label="Pincode" required inputMode="numeric" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input id="gstNumber" label="GST number (optional)" value={form.gstNumber} onChange={(e) => set('gstNumber', e.target.value.toUpperCase())} />
        <Input id="drugLicenceNo" label="Drug licence no. (optional)" value={form.drugLicenceNo} onChange={(e) => set('drugLicenceNo', e.target.value)} />
      </div>
      <Select id="customerType" label="Customer type" value={form.customerType} onChange={(e) => set('customerType', e.target.value)}>
        <option value="PHARMACY">Pharmacy / Medical Shop</option>
        <option value="HOSPITAL">Hospital</option>
        <option value="CLINIC">Clinic</option>
        <option value="INSTITUTION">Institution</option>
        <option value="OTHER">Other</option>
      </Select>
      <Button type="submit" fullWidth size="lg" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit Registration'}
      </Button>
      <p className="text-xs text-ink-faint">
        Your registration will be reviewed by Kapila Medical Agencies before you can log in and place orders.
      </p>
    </form>
  );
}
