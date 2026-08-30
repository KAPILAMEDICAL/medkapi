import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

/**
 * Writes an immutable audit trail row. Call this for every action that
 * matters for pharmaceutical-distribution accountability: price changes,
 * customer approval/rejection, order status changes, payment verification,
 * expense approval/rejection, offer creation, settings changes.
 */
export async function writeAuditLog(params: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  let ipAddress: string | undefined;
  try {
    const hdrs = await headers();
    ipAddress = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim();
  } catch {
    // headers() is only available inside a request context; audit calls
    // from scripts (e.g. seed) simply omit the IP.
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadataJson: params.metadata as never,
      ipAddress,
    },
  });
}
