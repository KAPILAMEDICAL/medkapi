'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Purpose = 'CUSTOMER_LOGIN' | 'SALES_LOGIN';

export function OtpLoginForm({ purpose }: { purpose: Purpose }) {
  const router = useRouter();
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (resendIn <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [resendIn]);

  async function requestOtp(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, purpose }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setStep('otp');
      setResendIn(json.data.resendAfterSeconds);
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, code, purpose }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      if (json.data.status === 'PENDING_APPROVAL') {
        setError(json.data.message);
        return;
      }
      router.push(json.data.redirectTo);
      router.refresh();
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (step === 'mobile') {
    return (
      <form onSubmit={requestOtp} className="space-y-4">
        <Input
          id="mobile"
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="98765 43210"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          error={error ?? undefined}
          required
          autoFocus
        />
        <Button type="submit" fullWidth size="lg" disabled={pending || mobile.trim().length < 10}>
          {pending ? 'Sending OTP…' : 'Send OTP'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} className="space-y-4">
      <p className="text-sm text-ink-muted">
        Enter the 6-digit code sent to <span className="font-medium text-ink">{mobile}</span>.
      </p>
      <Input
        id="otp"
        label="OTP"
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        error={error ?? undefined}
        required
        autoFocus
      />
      <Button type="submit" fullWidth size="lg" disabled={pending || code.length !== 6}>
        {pending ? 'Verifying…' : 'Verify & Continue'}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="text-ink-muted underline" onClick={() => setStep('mobile')}>
          Change number
        </button>
        <button
          type="button"
          className="text-brand-600 underline disabled:text-ink-faint disabled:no-underline"
          disabled={resendIn > 0}
          onClick={() => requestOtp()}
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
        </button>
      </div>
    </form>
  );
}
