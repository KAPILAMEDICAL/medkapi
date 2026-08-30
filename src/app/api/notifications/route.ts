import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { UnauthorizedError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where: { userId: session.userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
    ]);

    return ok({ items, unreadCount });
  } catch (err) {
    return fail(err);
  }
}

const patchSchema = z.object({ id: z.string().cuid().optional(), markAllRead: z.boolean().optional() });

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    const body = patchSchema.parse(await req.json());

    if (body.markAllRead) {
      await prisma.notification.updateMany({ where: { userId: session.userId, isRead: false }, data: { isRead: true } });
    } else if (body.id) {
      await prisma.notification.updateMany({ where: { id: body.id, userId: session.userId }, data: { isRead: true } });
    }

    return ok({ status: 'UPDATED' });
  } catch (err) {
    return fail(err);
  }
}
