'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function NewCompanyPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || undefined, contactInfo: contactInfo || undefined }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.push('/admin/companies');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Add Company" />
      <Card>
        <CardBody className="space-y-4">
          {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}
          <Input id="name" label="Company name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Textarea id="description" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input id="contactInfo" label="Contact information" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
          <Button disabled={pending || !name} onClick={submit}>
            {pending ? 'Saving…' : 'Create Company'}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
