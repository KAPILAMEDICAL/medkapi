import { test, expect } from '@playwright/test';
import { readOtp, currentOtp } from './helpers';

const SEEDED_SALESMAN_MOBILE = '9900000011'; // Ganesh Bhat — see prisma/seed.ts

test('a salesman can log in and see their dashboard and today\'s tour', async ({ page }) => {
  // This mobile number is reused across test runs — see admin-flow.spec.ts
  // for why we must wait for a code that differs from any stale leftover.
  const staleCode = await currentOtp(SEEDED_SALESMAN_MOBILE);

  await page.goto('/login/sales');
  await page.getByLabel('Mobile number').fill(SEEDED_SALESMAN_MOBILE);
  await page.getByRole('button', { name: 'Send OTP' }).click();

  const code = await readOtp(SEEDED_SALESMAN_MOBILE, staleCode);
  await page.getByLabel('OTP').fill(code);
  await page.getByRole('button', { name: 'Verify & Continue' }).click();

  await expect(page).toHaveURL(/\/sales$/);
  await expect(page.getByRole('heading', { name: /Ganesh Bhat/ })).toBeVisible();
  await expect(page.getByText('Quick Actions')).toBeVisible();

  await page.getByRole('link', { name: "Today's Tour" }).click();
  await expect(page).toHaveURL(/\/sales\/tour$/);
  await expect(page.getByRole('heading', { name: "Today's Tour" })).toBeVisible();
});
