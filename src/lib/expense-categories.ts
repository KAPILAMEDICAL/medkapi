import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { NotFoundError } from '@/lib/auth/rbac';

/**
 * Admin-configurable expense categories (Master Prompt §5). Categories
 * are never hard-deleted — an in-use category is deactivated instead, so
 * existing expense history keeps a valid, readable category label.
 */

export function listCategories(includeInactive = false) {
  return prisma.expenseCategoryConfig.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function createCategory(params: { name: string; code: string; sortOrder?: number; actorUserId: string }) {
  const category = await prisma.expenseCategoryConfig.create({
    data: { name: params.name, code: params.code, sortOrder: params.sortOrder ?? 0 },
  });
  await writeAuditLog({
    actorUserId: params.actorUserId,
    action: 'EXPENSE_CATEGORY_CREATED',
    entityType: 'ExpenseCategoryConfig',
    entityId: category.id,
    metadata: { name: category.name, code: category.code },
  });
  return category;
}

export async function updateCategory(params: {
  categoryId: string;
  actorUserId: string;
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const existing = await prisma.expenseCategoryConfig.findUnique({ where: { id: params.categoryId } });
  if (!existing) throw new NotFoundError('Category not found.');

  const category = await prisma.expenseCategoryConfig.update({
    where: { id: params.categoryId },
    data: {
      ...(params.name !== undefined ? { name: params.name } : {}),
      ...(params.sortOrder !== undefined ? { sortOrder: params.sortOrder } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    },
  });

  await writeAuditLog({
    actorUserId: params.actorUserId,
    action: 'EXPENSE_CATEGORY_UPDATED',
    entityType: 'ExpenseCategoryConfig',
    entityId: category.id,
    metadata: { before: existing, after: category },
  });
  return category;
}
