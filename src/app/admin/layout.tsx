import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { isAdminRole } from '@/lib/auth/rbac';
import { TopBar } from '@/components/nav/TopBar';
import { AdminSidebar, AdminMobileNav } from '@/components/nav/AdminNav';
import { DemoDataBanner } from '@/components/DemoDataBanner';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session || !isAdminRole(session.role)) redirect('/login/admin');

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect('/login/admin');

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1">
        <TopBar displayName={user.name ?? 'Admin'} role={session.role} mobileNav={<AdminMobileNav />} />
        <DemoDataBanner />
        <main className="mx-auto max-w-7xl p-4">{children}</main>
      </div>
    </div>
  );
}
