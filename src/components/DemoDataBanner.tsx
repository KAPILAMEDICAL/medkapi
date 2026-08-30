import { prisma } from '@/lib/db';

/**
 * Persistent, honest notice shown whenever the database still contains
 * the fictional seed data from `npm run db:seed` (Master Prompt §53).
 * Disappears automatically once an admin clears the `seed.isDemoData`
 * setting (see /admin/settings) — real production data is never labeled
 * as demo.
 */
export async function DemoDataBanner() {
  const setting = await prisma.setting.findUnique({ where: { key: 'seed.isDemoData' } });
  if (!setting || setting.valueJson !== true) return null;

  return (
    <div className="bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-warning">
      DEMO DATA — companies, products, and customers shown here are fictional sample data, not real Kapila Medical
      Agencies records.
    </div>
  );
}
