import Link from 'next/link';
import { Store, Bike, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-semibold text-ink">Kapila Medical Agencies</h1>
        <p className="mt-1 text-sm text-ink-muted">Pharmaceutical Wholesale &amp; Distribution</p>
        <p className="text-sm text-ink-faint">Sirsi, Uttara Kannada, Karnataka</p>
      </div>

      <div className="space-y-3">
        <RoleCard
          href="/login/customer"
          icon={Store}
          title="Customer Portal"
          description="Medical shops, pharmacies, hospitals & clinics — order, track and pay."
        />
        <RoleCard
          href="/login/sales"
          icon={Bike}
          title="Sales Team Portal"
          description="Field sales — today's tour, order booking, payment collection, expenses."
        />
        <RoleCard
          href="/login/admin"
          icon={ShieldCheck}
          title="Admin Portal"
          description="Business management — orders, customers, products, reports."
        />
      </div>
    </main>
  );
}

function RoleCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Store;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="flex items-center gap-4 p-4 transition-colors hover:border-brand-300">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon size={22} />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-sm text-ink-muted">{description}</p>
        </div>
      </Card>
    </Link>
  );
}
