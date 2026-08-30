import { prisma } from '@/lib/db';
import { generateOrderNumber } from '@/lib/ids';
import { computeOrderTotals, orderingUnitPrice } from '@/lib/pricing';
import { writeAuditLog } from '@/lib/audit';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import type { OrderSource } from '@prisma/client';

export class OrderBookingError extends Error {}

export interface BookOrderInput {
  customerId: string;
  createdByUserId: string;
  salesmanId?: string;
  source: OrderSource;
  items: { productId: string; quantity: number }[];
  notes?: string;
}

/**
 * Books an order end-to-end: validates the customer + products, prices
 * every line using the customer's actual wholesale price (never trusting
 * a client-supplied price), writes the Order + OrderItems + an INVOICE
 * ledger entry in one transaction, and fires the "new order" / "order
 * confirmed" notifications. Used by both the customer self-service
 * booking flow and the sales-team "book on behalf of customer" flow.
 */
export async function bookOrder(input: BookOrderInput) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new OrderBookingError('Customer not found.');
  if (customer.status !== 'APPROVED') {
    throw new OrderBookingError('This customer account is not approved for ordering.');
  }

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const missing = productIds.filter((id) => !productMap.has(id));
  if (missing.length > 0) {
    throw new OrderBookingError('One or more products in this order are no longer available.');
  }

  const lineInputs = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    if (item.quantity < product.minOrderQty) {
      throw new OrderBookingError(`${product.name} requires a minimum order quantity of ${product.minOrderQty}.`);
    }
    return {
      product,
      quantity: item.quantity,
      unitPrice: orderingUnitPrice(product),
      gstPercent: Number(product.gstPercent),
    };
  });

  const totals = computeOrderTotals(
    lineInputs.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity, gstPercent: l.gstPercent })),
  );

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: customer.id,
        createdByUserId: input.createdByUserId,
        salesmanId: input.salesmanId,
        source: input.source,
        status: 'BOOKED',
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        notes: input.notes,
        items: {
          create: lineInputs.map((l, i) => ({
            productId: l.product.id,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            gstPercent: l.gstPercent,
            lineTotal: totals.lines[i]!.lineTotal + totals.lines[i]!.taxAmount,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    const lastEntry = await tx.ledgerEntry.findFirst({
      where: { customerId: customer.id },
      orderBy: { entryDate: 'desc' },
    });
    const previousBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;

    await tx.ledgerEntry.create({
      data: {
        customerId: customer.id,
        entryType: 'INVOICE',
        referenceOrderId: created.id,
        description: `Invoice for order ${created.orderNumber}`,
        debit: totals.grandTotal,
        balanceAfter: previousBalance + totals.grandTotal,
      },
    });

    return created;
  });

  await writeAuditLog({
    actorUserId: input.createdByUserId,
    action: 'ORDER_BOOKED',
    entityType: 'Order',
    entityId: order.id,
    metadata: { orderNumber: order.orderNumber, grandTotal: totals.grandTotal, source: input.source },
  });

  await notifyUser(customer.userId, {
    type: 'ORDER_CONFIRMED',
    title: 'Order booked successfully',
    body: `Order ${order.orderNumber} for ₹${totals.grandTotal.toFixed(2)} has been booked.`,
    linkUrl: `/customer/orders/${order.id}`,
  });
  await notifyAdmins({
    type: 'NEW_ORDER',
    title: 'New order received',
    body: `${customer.firmName} booked order ${order.orderNumber} for ₹${totals.grandTotal.toFixed(2)}.`,
    linkUrl: `/admin/orders/${order.id}`,
  });

  return order;
}
