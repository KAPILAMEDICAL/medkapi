'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

/** Generic PATCH/POST action button used across admin approve/reject/verify/status-change flows. */
export function ActionButton({
  url,
  method = 'PATCH',
  body,
  children,
  variant = 'primary',
  size = 'sm',
  confirmMessage,
}: {
  url: string;
  method?: 'PATCH' | 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Button variant={variant} size={size} disabled={pending} onClick={run}>
        {pending ? '…' : children}
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
