import { prisma } from '@/lib/db';
import { generatePaymentNumber } from '@/lib/ids';
import { writeAuditLog } from '@/lib/audit';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import type { PaymentMode } from '@prisma/client';

export class PaymentEntryError extends Error {}

export interface RecordPaymentInput {
  customerId: string;
  recordedByUserId: string;
  salesmanId?: string;
  amount: number;
  mode: PaymentMode;
  referenceNumber?: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: Date;
  remarks?: string;
  receiptImageUrl?: string;
}

/**
 * Records a payment collection and writes the corresponding ledger
 * credit in one transaction, so a customer's outstanding balance is
 * always in sync with what has actually been recorded. Cheque payments
 * start as PENDING (cleared only once the admin confirms realization);
 * every other mode is recorded as RECEIVED and can be VERIFIED by an
 * admin afterwards.
 */
export async function recordPayment(input: RecordPaymentInput) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new PaymentEntryError('Customer not found.');

  if (input.mode === 'CHEQUE' && !input.chequeNumber) {
    throw new PaymentEntryError('Cheque number is required for cheque payments.');
  }

  const status = input.mode === 'CHEQUE' ? 'PENDING' : 'RECEIVED';

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        paymentNumber: generatePaymentNumber(),
        customerId: customer.id,
        salesmanId: input.salesmanId,
        recordedByUserId: input.recordedByUserId,
        amount: input.amount,
        mode: input.mode,
        status,
        referenceNumber: input.referenceNumber,
        chequeNumber: input.chequeNumber,
        chequeBank: input.chequeBank,
        chequeDate: input.chequeDate,
        remarks: input.remarks,
        receiptImageUrl: input.receiptImageUrl,
      },
    });

    const lastEntry = await tx.ledgerEntry.findFirst({ where: { customerId: customer.id }, orderBy: { entryDate: 'desc' } });
    const previousBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;

    await tx.ledgerEntry.create({
      data: {
        customerId: customer.id,
        entryType: 'PAYMENT',
        referencePaymentId: created.id,
        description: `Payment received — ${created.paymentNumber} (${input.mode})`,
        credit: input.amount,
        balanceAfter: previousBalance - input.amount,
      },
    });

    return created;
  });

  await writeAuditLog({
    actorUserId: input.recordedByUserId,
    action: 'PAYMENT_RECORDED',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { amount: input.amount, mode: input.mode, customerId: customer.id },
  });

  await notifyUser(customer.userId, {
    type: 'PAYMENT_RECEIVED',
    title: 'Payment recorded',
    body: `Payment of ₹${input.amount.toFixed(2)} has been recorded against your account.`,
    linkUrl: '/customer/account',
  });
  await notifyAdmins({
    type: 'PAYMENT_RECEIVED',
    title: 'Payment received',
    body: `₹${input.amount.toFixed(2)} received from ${customer.firmName} via ${input.mode}.`,
    linkUrl: `/admin/payments/${payment.id}`,
  });

  return payment;
}
