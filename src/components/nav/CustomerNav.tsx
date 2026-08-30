'use client';

import { Home, Search, Building2, ClipboardList, User } from 'lucide-react';
import { BottomNav, type NavItem } from '@/components/nav/BottomNav';

// Icon components (functions) cannot cross the server→client boundary as
// props, so each portal's nav item list is defined here, inside the
// client bundle, instead of being passed down from a server layout.
const ITEMS: NavItem[] = [
  { href: '/customer', label: 'Home', icon: Home },
  { href: '/customer/products', label: 'Products', icon: Search },
  { href: '/customer/companies', label: 'Companies', icon: Building2 },
  { href: '/customer/orders', label: 'Orders', icon: ClipboardList },
  { href: '/customer/account', label: 'Account', icon: User },
];

export function CustomerNav() {
  return <BottomNav items={ITEMS} />;
}
