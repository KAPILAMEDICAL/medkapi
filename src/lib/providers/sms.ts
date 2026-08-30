/**
 * SMS / OTP delivery provider abstraction.
 *
 * PRODUCTION INTEGRATION POINT
 * -----------------------------------------------------------------------
 * The only implementation shipped here is `ConsoleSmsProvider`, which
 * writes the OTP to the server log instead of sending a real SMS. This is
 * intentional and safe for local development and demos, but it MUST be
 * replaced before go-live: implement an `Msg91SmsProvider` (or Twilio,
 * or any DLT-registered Indian SMS gateway — required for OTP delivery
 * to Indian mobile numbers) that satisfies the same `SmsProvider`
 * interface, then switch it in `getSmsProvider()` below via the
 * SMS_PROVIDER env var. No other code in the app needs to change.
 */

import path from 'node:path';
import fs from 'node:fs/promises';

export interface SmsProvider {
  /** Send a numeric OTP code to a mobile number for a login/verification purpose. */
  sendOtp(mobile: string, code: string, purposeLabel: string): Promise<void>;
  /** Send a plain transactional notification (order confirmed, dispatched, etc). */
  sendNotification(mobile: string, message: string): Promise<void>;
}

/**
 * Test-only provider: behaves exactly like the console provider, but
 * also writes the last OTP per mobile number to a local JSON file so the
 * Playwright e2e suite (tests/e2e/*) can read it without ever seeing a
 * real SMS gateway or scraping server logs. Only ever activated by
 * playwright.config.ts setting SMS_PROVIDER=test-file for its own
 * webServer process — never a valid choice in .env for a real deployment.
 */
class TestFileSmsProvider implements SmsProvider {
  private filePath = path.join(process.cwd(), '.playwright-otp.json');

  async sendOtp(mobile: string, code: string, purposeLabel: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[TEST SMS PROVIDER] OTP for ${mobile} (${purposeLabel}): ${code}`);
    let data: Record<string, string> = {};
    try {
      data = JSON.parse(await fs.readFile(this.filePath, 'utf-8'));
    } catch {
      // file may not exist yet
    }
    data[mobile] = code;
    await fs.writeFile(this.filePath, JSON.stringify(data));
  }

  async sendNotification(mobile: string, message: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[TEST SMS PROVIDER] Notification to ${mobile}: ${message}`);
  }
}

class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(mobile: string, code: string, purposeLabel: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      `[DEV SMS PROVIDER] OTP for ${mobile} (${purposeLabel}): ${code} — ` +
        `this is only printed to the console because SMS_PROVIDER=console. ` +
        `Configure a real gateway before production.`,
    );
  }

  async sendNotification(mobile: string, message: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[DEV SMS PROVIDER] Notification to ${mobile}: ${message}`);
  }
}

let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const kind = process.env.SMS_PROVIDER ?? 'console';
  switch (kind) {
    case 'console':
      cached = new ConsoleSmsProvider();
      break;
    case 'test-file':
      cached = new TestFileSmsProvider();
      break;
    default:
      throw new Error(
        `SMS_PROVIDER="${kind}" has no implementation yet. Implement it in ` +
          `src/lib/providers/sms.ts and register it here before use.`,
      );
  }
  return cached;
}
