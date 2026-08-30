import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { ok } from '@/lib/api-response';

/** Lets client components bootstrap "who am I" (role + display name) without re-deriving it from cookies. */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return ok({ authenticated: false });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { customer: true, salesman: true },
  });
  if (!user) return ok({ authenticated: false });

  const displayName = user.customer?.firmName ?? user.salesman?.name ?? user.name ?? 'User';

  return ok({
    authenticated: true,
    role: user.role,
    displayName,
    customerId: user.customer?.id,
    salesmanId: user.salesman?.id,
  });
}
