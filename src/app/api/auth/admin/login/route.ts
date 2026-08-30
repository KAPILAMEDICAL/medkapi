import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requestOtp } from '@/lib/auth/otp';
import { isAdminRole, AuthError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';

const schema = z.object({
  identifier: z.string().trim().min(3), // mobile or email
  password: z.string().min(1),
});

/**
 * Step 1 of admin login: verify mobile/email + password. On success, an
 * OTP is sent to the admin's registered mobile (2FA) and the client is
 * told to prompt for it — see /api/auth/admin/otp-verify for step 2.
 * On failure, a single generic message is returned regardless of whether
 * the identifier or the password was wrong, to avoid account enumeration.
 */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const isEmail = body.identifier.includes('@');

    const user = await prisma.user.findFirst({
      where: isEmail ? { email: body.identifier.toLowerCase() } : { mobile: body.identifier.replace(/\D/g, '').slice(-10) },
    });

    const genericError = 'Invalid credentials. Please check your mobile/email and password.';

    if (!user || !isAdminRole(user.role) || !user.isActive || !user.passwordHash) {
      return fail(new AuthError(genericError));
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return fail(new AuthError(genericError));
    }

    if (!user.mobile) {
      return fail(new AuthError('This admin account has no mobile number on file for 2FA. Contact the super admin.'));
    }

    await requestOtp(user.mobile, 'ADMIN_LOGIN_2FA');

    return ok({ status: 'OTP_SENT', mobileMasked: maskMobile(user.mobile) });
  } catch (err) {
    return fail(err);
  }
}

function maskMobile(mobile: string): string {
  return `${'x'.repeat(6)}${mobile.slice(-4)}`;
}
