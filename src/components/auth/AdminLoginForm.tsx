'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function AdminLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mobileMasked, setMobileMasked] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setMobileMasked(json.data.mobileMasked);
      setStep('otp');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function submitOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/auth/admin/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, code }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      router.push(json.data.redirectTo);
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (step === 'credentials') {
    return (
      <form onSubmit={submitCredentials} className="space-y-4">
        <Input
          id="identifier"
          label="Mobile number or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoFocus
        />
        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
          required
        />
        <Button type="submit" fullWidth size="lg" disabled={pending}>
          {pending ? 'Checking…' : 'Continue'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitOtp} className="space-y-4">
      <p className="text-sm text-ink-muted">
        Enter the 6-digit verification code sent to <span className="font-medium text-ink">{mobileMasked}</span>.
      </p>
      <Input
        id="otp"
        label="Verification code"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        error={error ?? undefined}
        required
        autoFocus
      />
      <Button type="submit" fullWidth size="lg" disabled={pending || code.length !== 6}>
        {pending ? 'Verifying…' : 'Verify & Sign in'}
      </Button>
    </form>
  );
}
