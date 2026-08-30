import { test, expect } from '@playwright/test';
import { uniqueMobile, readOtp } from './helpers';

test('a new medical shop can register and sees a pending-approval message', async ({ page }) => {
  const mobile = uniqueMobile();

  await page.goto('/register');
  await page.getByLabel('Firm name').fill('E2E Test Pharmacy');
  await page.getByLabel('Owner / contact person').fill('Test Owner');
  await page.getByLabel('Mobile number').fill(mobile);
  await page.getByLabel('Address').fill('Test Road');
  await page.getByLabel('City').fill('Sirsi');
  await page.getByLabel('Pincode').fill('581401');
  await page.getByRole('button', { name: 'Submit Registration' }).click();

  await expect(page.getByText(/awaiting admin approval|reviewed by Kapila Medical Agencies/i)).toBeVisible();

  // The account exists but cannot log in yet — OTP is sent (mobile is
  // verified), but verifying it must surface the pending-approval state
  // rather than logging the shop in.
  await page.goto('/login/customer');
  await page.getByLabel('Mobile number').fill(mobile);
  await page.getByRole('button', { name: 'Send OTP' }).click();

  const code = await readOtp(mobile);
  await page.getByLabel('OTP').fill(code);
  await page.getByRole('button', { name: 'Verify & Continue' }).click();

  await expect(page.getByText(/awaiting admin approval/i)).toBeVisible();
  await expect(page).toHaveURL(/login\/customer/); // never redirected into the customer portal
});
