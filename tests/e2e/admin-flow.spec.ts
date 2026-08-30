import { test, expect } from '@playwright/test';
import { readOtp, currentOtp, uniqueMobile } from './helpers';

const SUPER_ADMIN_MOBILE = process.env.SUPER_ADMIN_MOBILE ?? '9900000000';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe@123';

test('a super admin can log in with password + OTP and approve a pending customer', async ({ page, request }) => {
  const mobile = uniqueMobile();
  // Unique per run so leftover fixtures from earlier test runs never
  // collide with (or get mistaken for) this run's row in the customer list.
  const firmName = `E2E Admin Approval Test Pharmacy ${mobile}`;

  // Self-contained fixture: register a fresh customer via the public API
  // so this test never depends on other specs' or manual runs' DB state.
  const registerRes = await request.post('/api/customers/register', {
    data: {
      firmName,
      ownerName: 'Test Owner',
      mobile,
      address: 'Test Road',
      city: 'Sirsi',
      pincode: '581401',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  // SUPER_ADMIN_MOBILE is fixed and reused across test runs, so capture
  // whatever OTP is already on file before triggering a new one — otherwise
  // a stale code from an earlier run could be read as if it were fresh.
  const staleCode = await currentOtp(SUPER_ADMIN_MOBILE);

  await page.goto('/login/admin');
  await page.getByLabel('Mobile number or email').fill(SUPER_ADMIN_MOBILE);
  await page.getByLabel('Password').fill(SUPER_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();

  const code = await readOtp(SUPER_ADMIN_MOBILE, staleCode);
  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: 'Verify & Sign in' }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.goto('/admin/customers?status=PENDING_APPROVAL');
  const row = page.getByText(firmName, { exact: true });
  await expect(row).toBeVisible();

  await page
    .locator('tr', { has: row })
    .getByRole('button', { name: 'Approve' })
    .click();

  await page.goto(`/admin/customers?status=APPROVED`);
  await expect(page.getByText(firmName, { exact: true })).toBeVisible();
});
