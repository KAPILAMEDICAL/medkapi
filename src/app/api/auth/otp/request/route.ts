import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { mobileSchema } from '@/lib/validation';
import { requestOtp, OtpInvalidError } from '@/lib/auth/otp';
import { ok, fail } from '@/lib/api-response';

const schema = z.object({
  mobile: mobileSchema,
  purpose: z.enum(['CUSTOMER_LOGIN', 'SALES_LOGIN', 'CUSTOMER_REGISTRATION']),
});

/**
 * Requests an OTP for customer / sales-team login or for verifying a
 * mobile number during customer self-registration. Admin login uses a
 * separate endpoint (/api/auth/admin/login) because it requires a
 * password check first.
 */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    if (body.purpose === 'CUSTOMER_LOGIN') {
      const customer = await prisma.customer.findUnique({ where: { mobile: body.mobile } });
      if (!customer) {
        throw new OtpInvalidError('No customer account found for this mobile number. Please register first.');
      }
      if (customer.status === 'DISABLED' || customer.status === 'REJECTED') {
        throw new OtpInvalidError('This account is not active. Please contact Kapila Medical Agencies.');
      }
    }

    if (body.purpose === 'SALES_LOGIN') {
      const salesman = await prisma.salesman.findUnique({ where: { mobile: body.mobile } });
      if (!salesman || !salesman.isActive) {
        throw new OtpInvalidError('No active sales-team account found for this mobile number.');
      }
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const result = await requestOtp(body.mobile, body.purpose, ip);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
