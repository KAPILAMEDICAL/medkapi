import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { mobileSchema, otpCodeSchema } from '@/lib/validation';
import { verifyOtp } from '@/lib/auth/otp';
import { isAdminRole, AuthError } from '@/lib/auth/rbac';
import { createSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit';
import { ok, fail } from '@/lib/api-response';

// The client re-submits the mobile from step 1 (masked to the admin in
// the UI, but not itself secret) alongside the OTP code.
const schema = z.object({
  identifier: z.string().trim().min(3), // same mobile/email used at step 1
  code: otpCodeSchema,
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const isEmail = body.identifier.includes('@');
    const user = await prisma.user.findFirst({
      where: isEmail ? { email: body.identifier.toLowerCase() } : { mobile: body.identifier.replace(/\D/g, '').slice(-10) },
    });

    if (!user || !isAdminRole(user.role) || !user.isActive || !user.mobile) {
      throw new AuthError('Invalid credentials.');
    }

    await verifyOtp(user.mobile, 'ADMIN_LOGIN_2FA', body.code);
    await createSession(user.id, user.role);
    await writeAuditLog({ actorUserId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id });

    return ok({ status: 'LOGGED_IN', redirectTo: '/admin' });
  } catch (err) {
    return fail(err);
  }
}
