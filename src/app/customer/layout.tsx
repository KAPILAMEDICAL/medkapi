import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { CustomerNav } from '@/components/nav/CustomerNav';
import { CartProvider } from '@/lib/cart';
import { DemoDataBanner } from '@/components/DemoDataBanner';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'CUSTOMER') redirect('/login/customer');

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
  if (!customer) redirect('/login/customer');

  return (
    <CartProvider>
      <div className="min-h-screen pb-16 md:pb-0">
        <TopBar displayName={customer.firmName} role="Customer" />
        <DemoDataBanner />
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
        <CustomerNav />
      </div>
    </CartProvider>
  );
}
