import { listCategories } from '@/lib/expense-categories';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { CategoryRowActions } from '@/components/admin/CategoryRowActions';

export default async function AdminExpenseCategoriesPage() {
  const categories = await listCategories(true);

  return (
    <div className="space-y-4">
      <PageHeader title="Expense Categories" description="Admin-configurable — add new categories or retire old ones (§5)." />

      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>
        <CardBody>
          <CategoryForm />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-ink-faint/10 py-2 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{c.name}</span>
                <span className="text-xs text-ink-faint">{c.code}</span>
                {!c.isActive && <Badge tone="neutral">Inactive</Badge>}
              </div>
              <CategoryRowActions categoryId={c.id} name={c.name} isActive={c.isActive} />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
