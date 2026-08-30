import { test, expect } from '@playwright/test';
import { readOtp, currentOtp } from './helpers';

const SEEDED_CUSTOMER_MOBILE = '9900001002'; // Yellapur Pharma Point, APPROVED — see prisma/seed.ts

test('an approved customer can log in, search a product, book an order, and see it confirmed', async ({ page }) => {
  // This mobile number is reused across test runs — see admin-flow.spec.ts
  // for why we must wait for a code that differs from any stale leftover.
  const staleCode = await currentOtp(SEEDED_CUSTOMER_MOBILE);

  await page.goto('/login/customer');
  await page.getByLabel('Mobile number').fill(SEEDED_CUSTOMER_MOBILE);
  await page.getByRole('button', { name: 'Send OTP' }).click();

  const code = await readOtp(SEEDED_CUSTOMER_MOBILE, staleCode);
  await page.getByLabel('OTP').fill(code);
  await page.getByRole('button', { name: 'Verify & Continue' }).click();

  await expect(page).toHaveURL(/\/customer$/);
  await expect(page.getByRole('heading', { name: /Yellapur Pharma Point/ })).toBeVisible();

  await page.goto('/customer/products?query=parexol');
  await expect(page.getByText(/Parexol/).first()).toBeVisible();
  await page.getByText(/Parexol/).first().click();

  await expect(page).toHaveURL(/\/customer\/products\//);
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page.getByRole('button', { name: 'Added!' })).toBeVisible();

  await page.goto('/customer/cart');
  await expect(page.getByText(/Parexol/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Order' }).click();

  await expect(page).toHaveURL(/\/customer\/orders\/.+justBooked=1/);
  await expect(page.getByText('Order booked successfully!')).toBeVisible();
  await expect(page.getByText(/^ORD-/)).toBeVisible();
});
