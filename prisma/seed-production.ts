/**
 * PRODUCTION BOOTSTRAP SEED
 * ---------------------------------------------------------------------
 * Unlike prisma/seed.ts (which fills the database with fictional demo
 * data for development), this script creates ONLY what a brand-new,
 * real Kapila Medical Agencies deployment needs to become usable:
 *   - the first Super Admin account (from env vars)
 *   - core business/settings rows
 * It deliberately creates no companies, products, customers, or orders —
 * those come from the real Excel/CSV import once available (see
 * docs/DEPLOYMENT.md "Importing real data").
 *
 * Run with: npm run db:seed:production
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const mobile = process.env.SUPER_ADMIN_MOBILE;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!mobile || !password) {
    throw new Error('Set SUPER_ADMIN_MOBILE and SUPER_ADMIN_PASSWORD before running the production seed.');
  }
  if (password.length < 10) {
    throw new Error('SUPER_ADMIN_PASSWORD is too short for a production deployment. Use a long, unique password.');
  }

  await prisma.user.upsert({
    where: { mobile },
    update: {},
    create: {
      role: Role.SUPER_ADMIN,
      mobile,
      name: 'Super Admin',
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  await prisma.setting.upsert({
    where: { key: 'seed.isDemoData' },
    update: { valueJson: false },
    create: { key: 'seed.isDemoData', valueJson: false },
  });

  await prisma.setting.upsert({
    where: { key: 'business.info' },
    update: {},
    create: {
      key: 'business.info',
      valueJson: {
        name: 'Kapila Medical Agencies',
        tagline: 'Pharmaceutical Wholesale & Distribution',
        address: 'Sirsi, Uttara Kannada, Karnataka',
        gstDefaultPercent: 12,
      },
    },
  });

  await prisma.setting.upsert({
    where: { key: 'order.settings' },
    update: {},
    create: { key: 'order.settings', valueJson: { requireAdminApprovalForNewOrders: false, minOrderValue: 0 } },
  });

  console.log(`Production bootstrap complete. Super Admin mobile: ${mobile}. Log in and change the password immediately.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
