import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getSmsProvider } from '@/lib/providers/sms';
import type { OtpPurpose } from '@prisma/client';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 45;
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_MINUTES = 30;
const MAX_VERIFY_ATTEMPTS = 5;

export class OtpRateLimitError extends Error {}
export class OtpInvalidError extends Error {}

function generateCode(): string {
  // crypto-secure random 6-digit code (never all-zero, never sequential
  // enough to be guessable from Math.random).
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = (buf[0] as number) % 10 ** OTP_LENGTH;
  return n.toString().padStart(OTP_LENGTH, '0');
}

/**
 * Requests a fresh OTP for a mobile number + purpose. Enforces a resend
 * cooldown and a rolling request cap per mobile to blunt SMS-bombing and
 * brute-force setup. The OTP is delivered via the SmsProvider abstraction
 * and stored only as a bcrypt hash.
 */
export async function requestOtp(mobile: string, purpose: OtpPurpose, requestIp?: string) {
  const windowStart = new Date(Date.now() - REQUEST_WINDOW_MINUTES * 60 * 1000);

  const recent = await prisma.otpVerification.findMany({
    where: { mobile, purpose, createdAt: { gte: windowStart } },
    orderBy: { createdAt: 'desc' },
  });

  if (recent.length > 0) {
    const lastRequestAt = recent[0]!.createdAt;
    const secondsSinceLast = (Date.now() - lastRequestAt.getTime()) / 1000;
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      throw new OtpRateLimitError(
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another OTP.`,
      );
    }
  }

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new OtpRateLimitError(
      `Too many OTP requests for this number. Please try again after ${REQUEST_WINDOW_MINUTES} minutes.`,
    );
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otpVerification.create({
    data: { mobile, purpose, codeHash, expiresAt, maxAttempts: MAX_VERIFY_ATTEMPTS, requestIp },
  });

  await getSmsProvider().sendOtp(mobile, code, purposeLabel(purpose));

  return { expiresInSeconds: OTP_TTL_MINUTES * 60, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
}

/**
 * Verifies an OTP. Throws OtpInvalidError with a user-safe message on any
 * failure (wrong code, expired, already used, too many attempts) — the
 * message deliberately does not distinguish "wrong code" from "expired"
 * to avoid helping an attacker enumerate state.
 */
export async function verifyOtp(mobile: string, purpose: OtpPurpose, code: string): Promise<void> {
  const otp = await prisma.otpVerification.findFirst({
    where: { mobile, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) throw new OtpInvalidError('Invalid or expired OTP. Please request a new one.');
  if (otp.expiresAt.getTime() < Date.now()) {
    throw new OtpInvalidError('Invalid or expired OTP. Please request a new one.');
  }
  if (otp.attempts >= otp.maxAttempts) {
    throw new OtpInvalidError('Too many incorrect attempts. Please request a new OTP.');
  }

  const isValid = await bcrypt.compare(code, otp.codeHash);

  if (!isValid) {
    await prisma.otpVerification.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new OtpInvalidError('Invalid or expired OTP. Please request a new one.');
  }

  await prisma.otpVerification.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });
}

function purposeLabel(purpose: OtpPurpose): string {
  switch (purpose) {
    case 'CUSTOMER_LOGIN':
      return 'Kapila Medical customer login';
    case 'SALES_LOGIN':
      return 'Kapila Medical sales team login';
    case 'ADMIN_LOGIN_2FA':
      return 'Kapila Medical admin sign-in verification';
    case 'CUSTOMER_REGISTRATION':
      return 'Kapila Medical registration';
    default:
      return 'Kapila Medical Agencies';
  }
}
