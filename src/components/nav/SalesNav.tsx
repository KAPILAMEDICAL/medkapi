'use client';

import { Home, MapPin, Users, ClipboardList, User } from 'lucide-react';
import { BottomNav, type NavItem } from '@/components/nav/BottomNav';

const ITEMS: NavItem[] = [
  { href: '/sales', label: 'Home', icon: Home },
  { href: '/sales/tour', label: 'Tour', icon: MapPin },
  { href: '/sales/customers', label: 'Customers', icon: Users },
  { href: '/sales/orders', label: 'Orders', icon: ClipboardList },
  { href: '/sales/profile', label: 'Profile', icon: User },
];

export function SalesNav() {
  return <BottomNav items={ITEMS} />;
}
