import { prisma } from '@/lib/db';
import { ADMIN_ROLES } from '@/lib/auth/rbac';

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
}

export async function notifyUser(userId: string, input: NotificationInput): Promise<void> {
  await prisma.notification.create({ data: { userId, ...input } });
}

export async function notifyUsers(userIds: string[], input: NotificationInput): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, ...input })) });
}

/** Notifies every active admin-type user (SUPER_ADMIN/ADMIN/SALES_MANAGER/ACCOUNTS). */
export async function notifyAdmins(input: NotificationInput): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ADMIN_ROLES }, isActive: true },
    select: { id: true },
  });
  await notifyUsers(admins.map((a) => a.id), input);
}
