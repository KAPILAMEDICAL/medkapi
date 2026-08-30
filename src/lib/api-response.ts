import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError, ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/auth/rbac';
import { OtpInvalidError, OtpRateLimitError } from '@/lib/auth/otp';
import { UnsafeFileError } from '@/lib/providers/storage';
import { OrderBookingError } from '@/lib/orders';
import { PaymentEntryError } from '@/lib/payments';

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}

/**
 * Converts any thrown error into a safe, user-facing JSON error response.
 * Never leaks stack traces, SQL, or internal messages: unrecognized
 * errors always fall back to a generic message, while known "expected"
 * error types surface their own user-safe text.
 */
export function fail(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? 'Please check the information you entered.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
  }
  if (err instanceof AuthError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
  }
  if (
    err instanceof OtpRateLimitError ||
    err instanceof OtpInvalidError ||
    err instanceof UnsafeFileError ||
    err instanceof OrderBookingError ||
    err instanceof PaymentEntryError
  ) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
  // eslint-disable-next-line no-console
  console.error('[api-error]', err);
  return NextResponse.json(
    { ok: false, error: 'Something went wrong on our end. Please try again in a moment.' },
    { status: 500 },
  );
}
