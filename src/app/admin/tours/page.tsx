import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { startOfDay } from '@/lib/tours';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AdminToursPage() {
  const today = startOfDay();
  const tours = await prisma.tourSchedule.findMany({
    where: { scheduleDate: today },
    include: { salesman: { select: { name: true } }, stops: { include: { customer: { select: { firmName: true } } } } },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Today's Tours"
        description={today.toDateString()}
        actions={
          <Link href="/admin/tours/new">
            <Button size="sm">
              <Plus size={16} /> Create Tour
            </Button>
          </Link>
        }
      />

      {tours.length === 0 ? (
        <EmptyState title="No tours scheduled for today." description="Create a tour to assign customer visits to a salesman." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tours.map((t) => (
            <Card key={t.id} className="p-4">
              <p className="text-sm font-semibold text-ink">{t.salesman.name}</p>
              <ul className="mt-2 space-y-1.5">
                {t.stops.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span>{s.plannedTime ? `${s.plannedTime} · ` : ''}{s.customer.firmName}</span>
                    <StatusBadge status={s.status} kind="order" />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
