import Link from 'next/link';
import Image from 'next/image';
import { Download } from 'lucide-react';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/admin/ActionButton';
import type { ExpenseStatus, Prisma } from '@prisma/client';

const STATUS_OPTIONS: ExpenseStatus[] = ['PENDING', 'CORRECTION_REQUESTED', 'APPROVED', 'REJECTED', 'REIMBURSED'];

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; salesmanId?: string; categoryId?: string; month?: string; vendor?: string; duplicatesOnly?: string }>;
}) {
  const sp = await searchParams;

  let where: Prisma.ExpenseWhereInput = {};
  if (sp.status) where.status = sp.status as ExpenseStatus;
  if (sp.salesmanId) where.salesmanId = sp.salesmanId;
  if (sp.categoryId) where.categoryId = sp.categoryId;
  if (sp.vendor) {
    where.OR = [{ merchant: { contains: sp.vendor, mode: 'insensitive' } }, { billNumber: { contains: sp.vendor, mode: 'insensitive' } }];
  }
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const start = new Date(`${sp.month}-01T00:00:00.000Z`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    where.expenseDate = { gte: start, lt: end };
  }
  if (sp.duplicatesOnly === 'true') where.isPossibleDuplicate = true;

  const [expenses, salesmen, categories] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { salesman: { select: { id: true, name: true } }, category: { select: { name: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 150,
    }),
    prisma.salesman.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.expenseCategoryConfig.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const exportQuery = new URLSearchParams();
  if (sp.status) exportQuery.set('status', sp.status);
  if (sp.salesmanId) exportQuery.set('salesmanId', sp.salesmanId);
  if (sp.categoryId) exportQuery.set('categoryId', sp.categoryId);
  if (sp.vendor) exportQuery.set('vendor', sp.vendor);
  if (sp.month) exportQuery.set('month', sp.month);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses"
        description={`${expenses.length} expense(s)`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/expenditure" className="text-sm font-medium text-brand-600 self-center">
              Dashboard →
            </Link>
            <Link href="/admin/expenses/categories" className="text-sm font-medium text-brand-600 self-center">
              Categories
            </Link>
            <Link href="/admin/expenses/advances" className="text-sm font-medium text-brand-600 self-center">
              Advances
            </Link>
            <Link href="/admin/expenses/settlements" className="text-sm font-medium text-brand-600 self-center">
              Settlements
            </Link>
            <Link href="/admin/expenses/limits" className="text-sm font-medium text-brand-600 self-center">
              Limits
            </Link>
            <a href={`/api/expenses/export?${exportQuery.toString()}`}>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-ink-faint/40 px-3 py-2 text-sm text-ink">
                <Download size={14} /> Export CSV
              </span>
            </a>
          </div>
        }
      />

      <Card className="p-3">
        <form className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" method="get">
          <select name="status" defaultValue={sp.status ?? ''} className="rounded-md border border-ink-faint/40 bg-surface px-2 py-2 text-sm">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select name="salesmanId" defaultValue={sp.salesmanId ?? ''} className="rounded-md border border-ink-faint/40 bg-surface px-2 py-2 text-sm">
            <option value="">All sales boys</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select name="categoryId" defaultValue={sp.categoryId ?? ''} className="rounded-md border border-ink-faint/40 bg-surface px-2 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input type="month" name="month" defaultValue={sp.month ?? ''} className="rounded-md border border-ink-faint/40 bg-surface px-2 py-2 text-sm" />
          <input
            type="text"
            name="vendor"
            placeholder="Search vendor / bill #"
            defaultValue={sp.vendor ?? ''}
            className="rounded-md border border-ink-faint/40 bg-surface px-2 py-2 text-sm sm:col-span-2 lg:col-span-1"
          />
          <label className="flex items-center gap-1.5 text-xs text-ink-muted">
            <input type="checkbox" name="duplicatesOnly" value="true" defaultChecked={sp.duplicatesOnly === 'true'} />
            Duplicates only
          </label>
          <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Filter
          </button>
        </form>
      </Card>

      {expenses.length === 0 ? (
        <EmptyState title="No expenses match these filters." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {expenses.map((e) => (
            <Card key={e.id} className="flex gap-3 p-4">
              {e.billImageUrl && (
                <Link href={`/admin/expenses/${e.id}`}>
                  <Image src={e.billImageUrl} alt="Bill" width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-sm object-cover" />
                </Link>
              )}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/admin/expenses/${e.id}`} className="text-sm font-medium text-ink hover:text-brand-600">
                      {e.salesman.name}
                    </Link>
                    <p className="text-xs text-ink-faint">{e.category.name} · {e.merchant ?? '—'}</p>
                    <p className="text-xs text-ink-faint">{e.expenseDate.toDateString()}</p>
                    {e.isPossibleDuplicate && <Badge tone="warning">⚠️ Possible duplicate</Badge>}
                  </div>
                  <StatusBadge status={e.status} kind="expense" />
                </div>
                <p className="mt-1 text-sm font-semibold text-ink">₹{Number(e.amount).toFixed(2)}</p>
                {(e.status === 'PENDING' || e.status === 'CORRECTION_REQUESTED') && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <ActionButton url={`/api/expenses/${e.id}`} body={{ decision: 'APPROVED' }}>
                      Approve
                    </ActionButton>
                    <ActionButton
                      url={`/api/expenses/${e.id}`}
                      body={{ decision: 'REJECTED', adminRemarks: 'Not a valid business expense' }}
                      variant="outline"
                    >
                      Reject
                    </ActionButton>
                    <Link href={`/admin/expenses/${e.id}`}>
                      <span className="inline-flex min-h-[36px] items-center rounded-md border border-ink-faint/40 px-3 py-2 text-sm text-ink">
                        Review
                      </span>
                    </Link>
                  </div>
                )}
                {e.status === 'APPROVED' && (
                  <div className="mt-2">
                    <ActionButton url={`/api/expenses/${e.id}`} body={{ action: 'REIMBURSE' }}>
                      Mark Reimbursed
                    </ActionButton>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
