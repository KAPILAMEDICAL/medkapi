import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, ForbiddenError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { customerRegistrationSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const params = req.nextUrl.searchParams;
    const status = params.get('status');
    const query = params.get('query');
    const salesmanId = params.get('salesmanId');

    // Sales managers only see their team's customers; other admin roles see everyone.
    let scopeWhere: Record<string, unknown> = {};
    if (session.role === 'SALES_MANAGER') {
      const teamIds = (
        await prisma.salesman.findMany({ where: { managerUserId: session.userId }, select: { id: true } })
      ).map((s) => s.id);
      scopeWhere = { assignedSalesmanId: { in: teamIds } };
    }

    const customers = await prisma.customer.findMany({
      where: {
        ...scopeWhere,
        ...(status ? { status: status as never } : {}),
        ...(salesmanId ? { assignedSalesmanId: salesmanId } : {}),
        ...(query
          ? { OR: [{ firmName: { contains: query, mode: 'insensitive' } }, { mobile: { contains: query } }] }
          : {}),
      },
      include: { assignedSalesman: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return ok(customers);
  } catch (err) {
    return fail(err);
  }
}

const createSchema = customerRegistrationSchema.extend({
  assignedSalesmanId: z.string().cuid().optional(),
  status: z.enum(['APPROVED', 'PENDING_APPROVAL']).default('APPROVED'),
});

/** Admin can create a customer directly (already-approved onboarding, e.g. from a paper form). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = createSchema.parse(await req.json());

    const existing = await prisma.customer.findUnique({ where: { mobile: body.mobile } });
    if (existing) throw new ForbiddenError('A customer with this mobile number already exists.');

    const customer = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { role: 'CUSTOMER', mobile: body.mobile, email: body.email } });
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
          status: body.status,
          assignedSalesmanId: body.assignedSalesmanId,
          approvedByUserId: body.status === 'APPROVED' ? session.userId : null,
          approvedAt: body.status === 'APPROVED' ? new Date() : null,
        },
      });
    });

    await writeAuditLog({ actorUserId: session.userId, action: 'CUSTOMER_CREATED', entityType: 'Customer', entityId: customer.id });
    return ok(customer, 201);
  } catch (err) {
    return fail(err);
  }
}
