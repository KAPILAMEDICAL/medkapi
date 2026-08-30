import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { mobileSchema, otpCodeSchema } from '@/lib/validation';
import { verifyOtp, OtpInvalidError } from '@/lib/auth/otp';
import { createSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit';
import { ok, fail } from '@/lib/api-response';

const schema = z.object({
  mobile: mobileSchema,
  code: otpCodeSchema,
  purpose: z.enum(['CUSTOMER_LOGIN', 'SALES_LOGIN']),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    await verifyOtp(body.mobile, body.purpose, body.code);

    if (body.purpose === 'CUSTOMER_LOGIN') {
      const customer = await prisma.customer.findUnique({ where: { mobile: body.mobile }, include: { user: true } });
      if (!customer) throw new OtpInvalidError('No customer account found for this mobile number.');
      if (customer.status === 'PENDING_APPROVAL') {
        return ok({ status: 'PENDING_APPROVAL', message: 'Your registration is awaiting admin approval.' });
      }
      if (customer.status !== 'APPROVED') {
        throw new OtpInvalidError('This account is not active. Please contact Kapila Medical Agencies.');
      }
      await createSession(customer.userId, customer.user.role);
      await writeAuditLog({ actorUserId: customer.userId, action: 'LOGIN', entityType: 'Customer', entityId: customer.id });
      return ok({ status: 'LOGGED_IN', redirectTo: '/customer' });
    }

    const salesman = await prisma.salesman.findUnique({ where: { mobile: body.mobile }, include: { user: true } });
    if (!salesman || !salesman.isActive) throw new OtpInvalidError('No active sales-team account found.');
    await createSession(salesman.userId, salesman.user.role);
    await writeAuditLog({ actorUserId: salesman.userId, action: 'LOGIN', entityType: 'Salesman', entityId: salesman.id });
    return ok({ status: 'LOGGED_IN', redirectTo: '/sales' });
  } catch (err) {
    return fail(err);
  }
}
