import fs from 'node:fs/promises';
import path from 'node:path';

const OTP_FILE = path.join(process.cwd(), '.playwright-otp.json');

async function readOtpFile(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fs.readFile(OTP_FILE, 'utf-8')) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Reads the current OTP on file for `mobile`, if any — call this
 * immediately before triggering a "Send OTP" action so `readOtp` below
 * can wait for a genuinely NEW code rather than racing a stale one left
 * over from an earlier run against the same (e.g. admin) mobile number.
 */
export async function currentOtp(mobile: string): Promise<string | undefined> {
  return (await readOtpFile())[mobile];
}

/** Polls the test SMS provider's OTP file until a code for `mobile` appears that differs from `excluding`. */
export async function readOtp(mobile: string, excluding?: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const data = await readOtpFile();
    if (data[mobile] && data[mobile] !== excluding) return data[mobile];
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for a fresh OTP for ${mobile}`);
}

/** Generates a unique, valid-looking 10-digit Indian mobile number for a test run. */
export function uniqueMobile(): string {
  const suffix = Date.now().toString().slice(-9);
  return `7${suffix}`;
}
