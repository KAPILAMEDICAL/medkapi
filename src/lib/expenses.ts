import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import type { ExpenseCategory } from '@prisma/client';

export interface CreateExpenseInput {
  salesmanId: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: Date;
  merchant?: string;
  description?: string;
  billImageUrl?: string;
  ocrRawText?: string;
  ocrConfidence?: number;
  ocrProvider?: string;
}

/**
 * Creates a submitted expense. OCR fields (if any) are stored purely as
 * a record of what was auto-extracted — the amount/category/date actually
 * saved always come from what the salesman confirmed on screen, never
 * blindly from OCR output (Master Prompt §13).
 */
export async function createExpense(input: CreateExpenseInput) {
  const expense = await prisma.expense.create({
    data: { ...input, status: 'SUBMITTED' },
    include: { salesman: { include: { user: true } } },
  });

  await writeAuditLog({
    actorUserId: expense.salesman.userId,
    action: 'EXPENSE_SUBMITTED',
    entityType: 'Expense',
    entityId: expense.id,
    metadata: { category: input.category, amount: input.amount },
  });

  await notifyAdmins({
    type: 'EXPENSE_SUBMITTED',
    title: 'Expense awaiting approval',
    body: `${expense.salesman.name} submitted a ₹${input.amount.toFixed(2)} ${input.category.toLowerCase()} expense.`,
    linkUrl: `/admin/expenses/${expense.id}`,
  });

  return expense;
}

export async function reviewExpense(params: {
  expenseId: string;
  reviewedByUserId: string;
  decision: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}) {
  const expense = await prisma.expense.update({
    where: { id: params.expenseId },
    data: {
      status: params.decision,
      reviewedByUserId: params.reviewedByUserId,
      reviewedAt: new Date(),
      rejectionReason: params.decision === 'REJECTED' ? params.rejectionReason : null,
    },
    include: { salesman: true },
  });

  await writeAuditLog({
    actorUserId: params.reviewedByUserId,
    action: `EXPENSE_${params.decision}`,
    entityType: 'Expense',
    entityId: expense.id,
  });

  await notifyUser(expense.salesman.userId, {
    type: `EXPENSE_${params.decision}`,
    title: params.decision === 'APPROVED' ? 'Expense approved' : 'Expense rejected',
    body:
      params.decision === 'APPROVED'
        ? `Your ₹${Number(expense.amount).toFixed(2)} ${expense.category.toLowerCase()} expense was approved.`
        : `Your ₹${Number(expense.amount).toFixed(2)} expense was rejected. ${params.rejectionReason ?? ''}`.trim(),
    linkUrl: '/sales/expenses',
  });

  return expense;
}
