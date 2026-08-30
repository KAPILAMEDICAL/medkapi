import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError, requireAdmin, requireSuperAdmin } from '@/lib/auth/rbac';
import { reviewExpense, reimburseExpense, reopenExpense, updateExpense } from '@/lib/expenses';
import { expenseUpdateSchema, expenseReviewSchema } from '@/lib/validation';
import { ok, fail } from '@/lib/api-response';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    const { id } = await params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        salesman: { select: { id: true, name: true, userId: true, employeeCode: true } },
        category: true,
        reviewedBy: { select: { name: true } },
        duplicateOf: { select: { id: true, amount: true, expenseDate: true, merchant: true } },
        settlement: { select: { id: true, periodStart: true, periodEnd: true } },
      },
    });
    if (!expense) throw new NotFoundError('Expense not found.');
    if (session.role === 'SALES_BOY' && expense.salesman.userId !== session.userId) {
      throw new ForbiddenError('You cannot view this expense.');
    }

    return ok(expense);
  } catch (err) {
    return fail(err);
  }
}

const actionSchema = z.object({ action: z.literal('REIMBURSE') }).or(z.object({ action: z.literal('REOPEN'), reason: z.string().trim().min(3) }));

/** Admin decisions: approve / reject / request correction, plus reimburse and reopen. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body?.action === 'REOPEN') {
      const session = await requireSuperAdmin();
      const { reason } = actionSchema.parse(body) as { action: 'REOPEN'; reason: string };
      const expense = await reopenExpense({ expenseId: id, actorUserId: session.userId, reason });
      return ok(expense);
    }

    const session = await requireAdmin();

    if (body?.action === 'REIMBURSE') {
      const expense = await reimburseExpense({ expenseId: id, actorUserId: session.userId });
      return ok(expense);
    }

    const decisionBody = expenseReviewSchema.parse(body);
    const expense = await reviewExpense({
      expenseId: id,
      reviewedByUserId: session.userId,
      decision: decisionBody.decision,
      adminRemarks: decisionBody.adminRemarks,
    });
    return ok(expense);
  } catch (err) {
    return fail(err);
  }
}

/** Salesman self-edit: pre-approval corrections, and resubmission after REQUEST CORRECTION. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    const { id } = await params;

    const existing = await prisma.expense.findUnique({ where: { id }, include: { salesman: true } });
    if (!existing) throw new NotFoundError('Expense not found.');
    if (existing.salesman.userId !== session.userId) throw new ForbiddenError('You cannot edit this expense.');

    const body = expenseUpdateSchema.parse(await req.json());
    const expense = await updateExpense({
      expenseId: id,
      actorUserId: session.userId,
      categoryId: body.categoryId,
      amount: body.amount,
      gstAmount: body.gstAmount,
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined,
      merchant: body.merchant,
      billNumber: body.billNumber,
      paymentMode: body.paymentMode,
      description: body.description,
      remarks: body.remarks,
      billImageUrl: body.billImageUrl,
    });

    return ok(expense);
  } catch (err) {
    return fail(err);
  }
}
