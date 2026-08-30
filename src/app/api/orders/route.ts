import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { UnauthorizedError, ForbiddenError, isAdminRole } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { bookOrder, OrderBookingError } from '@/lib/orders';
import { orderBookingSchema } from '@/lib/validation';
import type { OrderSource, OrderStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    const params = req.nextUrl.searchParams;
    const status = params.get('status') as OrderStatus | null;
    const page = Number(params.get('page') ?? '1');
    const pageSize = Math.min(50, Number(params.get('pageSize') ?? '20'));

    let where: Record<string, unknown> = { ...(status ? { status } : {}) };

    if (session.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
      if (!customer) throw new ForbiddenError('No customer profile found.');
      where = { ...where, customerId: customer.id };
    } else if (session.role === 'SALES_BOY') {
      const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
      if (!salesman) throw new ForbiddenError('No sales profile found.');
      where = { ...where, salesmanId: salesman.id };
    } else if (!isAdminRole(session.role)) {
      throw new ForbiddenError('Not permitted to view orders.');
    } else {
      const customerId = params.get('customerId');
      const salesmanId = params.get('salesmanId');
      if (customerId) where = { ...where, customerId };
      if (salesmanId) where = { ...where, salesmanId };
    }

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { firmName: true, city: true } },
          salesman: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { bookedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return ok({ items, total, page, pageSize });
  } catch (err) {
    return fail(err);
  }
}

const bodySchema = orderBookingSchema;

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');

    const body = bodySchema.parse(await req.json());

    let customerId: string;
    let salesmanId: string | undefined;
    let source: OrderSource;

    if (session.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
      if (!customer) throw new ForbiddenError('No customer profile found.');
      customerId = customer.id;
      source = 'CUSTOMER_APP';
    } else if (session.role === 'SALES_BOY' || session.role === 'SALES_MANAGER') {
      const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
      if (!salesman) throw new ForbiddenError('No sales profile found.');
      if (!body.customerId) throw new OrderBookingError('Select a customer to book this order for.');
      const customer = await prisma.customer.findFirst({ where: { id: body.customerId, assignedSalesmanId: salesman.id } });
      if (!customer) throw new ForbiddenError('This customer is not assigned to you.');
      customerId = customer.id;
      salesmanId = salesman.id;
      source = 'SALES_APP';
    } else if (isAdminRole(session.role)) {
      if (!body.customerId) throw new OrderBookingError('Select a customer to book this order for.');
      customerId = body.customerId;
      source = 'ADMIN';
    } else {
      throw new ForbiddenError('Not permitted to book orders.');
    }

    const order = await bookOrder({
      customerId,
      createdByUserId: session.userId,
      salesmanId,
      source,
      items: body.items,
      notes: body.notes,
    });

    return ok({ orderId: order.id, orderNumber: order.orderNumber, grandTotal: Number(order.grandTotal) }, 201);
  } catch (err) {
    return fail(err);
  }
}
