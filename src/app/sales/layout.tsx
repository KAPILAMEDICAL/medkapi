import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { SalesNav } from '@/components/nav/SalesNav';
import { DemoDataBanner } from '@/components/DemoDataBanner';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session || (session.role !== 'SALES_BOY' && session.role !== 'SALES_MANAGER')) redirect('/login/sales');

  const salesman = await prisma.salesman.findUnique({ where: { userId: session.userId } });
  if (!salesman) redirect('/login/sales');

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <TopBar displayName={salesman.name} role={session.role} />
      <DemoDataBanner />
      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>
      <SalesNav />
    </div>
  );
}
