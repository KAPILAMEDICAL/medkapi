'use client';

import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Package,
  Building2,
  Tag,
  IndianRupee,
  Receipt,
  BarChart3,
  UserCog,
  MapPin,
  Settings,
} from 'lucide-react';
import { Sidebar } from '@/components/nav/Sidebar';
import type { NavItem } from '@/components/nav/BottomNav';

const ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/offers', label: 'Offers', icon: Tag },
  { href: '/admin/sales-team', label: 'Sales Team', icon: UserCog },
  { href: '/admin/tours', label: 'Tours', icon: MapPin },
  { href: '/admin/payments', label: 'Payments', icon: IndianRupee },
  { href: '/admin/expenses', label: 'Expenses', icon: Receipt },
  { href: '/admin/expenditure', label: 'Expenditure', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  return <Sidebar items={ITEMS} title="Admin Portal" />;
}

export function AdminMobileNav() {
  return (
    <nav className="grid grid-cols-3 gap-1">
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 rounded-md p-2 text-xs text-ink hover:bg-surface-subtle">
          <item.icon size={18} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
