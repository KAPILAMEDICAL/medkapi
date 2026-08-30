import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { customerRegistrationSchema } from '@/lib/validation';
import { writeAuditLog } from '@/lib/audit';
import { ok, fail } from '@/lib/api-response';
import { AuthError } from '@/lib/auth/rbac';

/**
 * Public customer self-registration. Creates the account in
 * PENDING_APPROVAL state — it cannot log in or place orders until an
 * admin approves it (see /admin/customers).
 */
export async function POST(req: NextRequest) {
  try {
    const body = customerRegistrationSchema.parse(await req.json());

    const existing = await prisma.customer.findUnique({ where: { mobile: body.mobile } });
    if (existing) {
      throw new AuthError('An account already exists for this mobile number. Please log in instead.');
    }

    const customer = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { role: 'CUSTOMER', mobile: body.mobile, email: body.email },
      });
      return tx.customer.create({
        data: {
          userId: user.id,
          firmName: body.firmName,
          ownerName: body.ownerName,
          mobile: body.mobile,
          whatsapp: body.whatsapp,
          email: body.email,
          address: body.address,
          area: body.area,
          city: body.city,
          pincode: body.pincode,
          gstNumber: body.gstNumber,
          drugLicenceNo: body.drugLicenceNo,
          customerType: body.customerType,
          status: 'PENDING_APPROVAL',
        },
      });
    });

    await writeAuditLog({
      actorUserId: null,
      action: 'CUSTOMER_REGISTERED',
      entityType: 'Customer',
      entityId: customer.id,
      metadata: { firmName: customer.firmName, mobile: customer.mobile },
    });

    return ok({
      status: 'PENDING_APPROVAL',
      message:
        'Registration submitted. Your account will be reviewed by Kapila Medical Agencies and activated shortly.',
    });
  } catch (err) {
    return fail(err);
  }
}
