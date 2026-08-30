'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';

export interface TourStopData {
  id: string;
  plannedTime: string | null;
  objective: string | null;
  status: string;
  customer: { id: string; firmName: string; mobile: string; address: string; city: string };
  visit: { id: string } | null;
  context: { outstanding: number; lastOrderAmount: number | null; lastPaymentAmount: number | null };
}

/**
 * Requests the browser's geolocation permission (the actual consent
 * mechanism — Master Prompt §16 "always use clear consent"). If denied,
 * unavailable, or the user ignores the prompt, the visit still starts —
 * location is simply omitted, never a blocker to doing the job.
 */
function getLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 },
    );
  });
}

export function TourStopCard({ stop }: { stop: TourStopData }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function startVisit() {
    setPending(true);
    try {
      const location = await getLocation();
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: stop.customer.id,
          tourStopId: stop.id,
          locationConsent: location !== null,
          lat: location?.lat,
          lng: location?.lng,
        }),
      });
      const json = await res.json();
      if (json.ok) router.push(`/sales/visit/${stop.customer.id}?visitId=${json.data.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">
            {stop.plannedTime && <span className="text-brand-600">{stop.plannedTime} · </span>}
            {stop.customer.firmName}
          </p>
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <MapPin size={12} /> {stop.customer.address}, {stop.customer.city}
          </p>
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <Phone size={12} /> {stop.customer.mobile}
          </p>
          {stop.objective && <p className="mt-1 text-xs text-ink-faint">{stop.objective}</p>}
        </div>
        <StatusBadge status={stop.status} kind="order" />
      </div>

      <div className="mt-2 flex gap-4 text-xs text-ink-muted">
        <span>Outstanding: <strong className="text-ink">₹{stop.context.outstanding.toFixed(0)}</strong></span>
        {stop.context.lastOrderAmount !== null && <span>Last order: ₹{stop.context.lastOrderAmount.toFixed(0)}</span>}
      </div>

      <div className="mt-3">
        {stop.status === 'PLANNED' && (
          <Button size="sm" fullWidth disabled={pending} onClick={startVisit}>
            {pending ? 'Starting…' : 'Start Visit'}
          </Button>
        )}
        {stop.status === 'IN_PROGRESS' && stop.visit && (
          <Button
            size="sm"
            fullWidth
            variant="outline"
            onClick={() => router.push(`/sales/visit/${stop.customer.id}?visitId=${stop.visit!.id}`)}
          >
            Continue Visit
          </Button>
        )}
        {stop.status === 'COMPLETED' && <p className="text-center text-xs text-success">Visit completed</p>}
      </div>
    </Card>
  );
}
