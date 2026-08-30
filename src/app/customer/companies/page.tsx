import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ letter?: string }> }) {
  const { letter } = await searchParams;

  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(letter ? { name: { startsWith: letter, mode: 'insensitive' } } : {}) },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">Company Directory</h1>

      <div className="flex flex-wrap gap-1">
        <AlphaLink letter={undefined} active={!letter} />
        {ALPHABET.map((l) => (
          <AlphaLink key={l} letter={l} active={letter === l} />
        ))}
      </div>

      {companies.length === 0 ? (
        <EmptyState title="No companies found." description="Try a different letter." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {companies.map((c) => (
            <Link key={c.id} href={`/customer/companies/${c.id}`}>
              <Card className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <Building2 size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-ink-faint">{c._count.products} product(s)</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AlphaLink({ letter, active }: { letter?: string; active: boolean }) {
  return (
    <Link
      href={letter ? `/customer/companies?letter=${letter}` : '/customer/companies'}
      className={`flex h-7 min-w-7 items-center justify-center rounded-sm px-1.5 text-xs font-medium ${
        active ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:bg-ink-faint/20'
      }`}
    >
      {letter ?? 'All'}
    </Link>
  );
}
