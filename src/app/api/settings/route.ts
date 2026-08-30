import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, requireSuperAdmin } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  try {
    await requireAdmin();
    const settings = await prisma.setting.findMany();
    return ok(Object.fromEntries(settings.map((s) => [s.key, s.valueJson])));
  } catch (err) {
    return fail(err);
  }
}

const schema = z.object({ key: z.string().min(1), value: z.unknown() });

/** Only a super admin may change business-critical settings (Master Prompt §28 role hierarchy). */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    const body = schema.parse(await req.json());

    const setting = await prisma.setting.upsert({
      where: { key: body.key },
      update: { valueJson: body.value as never, updatedByUserId: session.userId },
      create: { key: body.key, valueJson: body.value as never, updatedByUserId: session.userId },
    });

    await writeAuditLog({ actorUserId: session.userId, action: 'SETTING_UPDATED', entityType: 'Setting', entityId: setting.id, metadata: { key: body.key } });
    return ok(setting);
  } catch (err) {
    return fail(err);
  }
}
