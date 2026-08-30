import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError, isAdminRole } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { recordPayment } from '@/lib/payments';
import { paymentEntrySchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    const params = req.nextUrl.searchParams;
    const page = Number(params.get('page') ?? '1');
    const pageSize = Math.min(50, Number(params.get('pageSize') ?? '20'));

    let where: Record<string, unknown> = {};
    if (session.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
      if (!customer) throw new ForbiddenError('No customer profile found.');
      where = { customerId: customer.id };
    } else if (session.role === 'SALES_BOY') {
      const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
      if (!salesman) throw new ForbiddenError('No sales profile found.');
      where = { salesmanId: salesman.id };
    } else if (isAdminRole(session.role)) {
      const customerId = params.get('customerId');
      const status = params.get('status');
      if (customerId) where = { ...where, customerId };
      if (status) where = { ...where, status };
    } else {
      throw new ForbiddenError('Not permitted to view payments.');
    }

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { customer: { select: { firmName: true } }, salesman: { select: { name: true } } },
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);

    return ok({ items, total, page, pageSize });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    if (session.role !== 'SALES_BOY' && session.role !== 'SALES_MANAGER' && !isAdminRole(session.role)) {
      throw new ForbiddenError('Only sales staff or admins can record payments.');
    }

    const body = paymentEntrySchema.parse(await req.json());

    let salesmanId: string | undefined;
    if (session.role === 'SALES_BOY' || session.role === 'SALES_MANAGER') {
      const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
      if (!salesman) throw new ForbiddenError('No sales profile found.');
      salesmanId = salesman.id;
    }

    const payment = await recordPayment({
      customerId: body.customerId,
      recordedByUserId: session.userId,
      salesmanId,
      amount: body.amount,
      mode: body.mode,
      referenceNumber: body.referenceNumber,
      chequeNumber: body.chequeNumber,
      chequeBank: body.chequeBank,
      chequeDate: body.chequeDate ? new Date(body.chequeDate) : undefined,
      remarks: body.remarks,
      receiptImageUrl: body.receiptImageUrl,
    });

    return ok({ paymentId: payment.id, paymentNumber: payment.paymentNumber }, 201);
  } catch (err) {
    return fail(err);
  }
}
