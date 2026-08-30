'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Fixed bottom navigation for the mobile-first customer and sales-team
 * portals — large tap targets, five items max (Master Prompt §32/§35),
 * with a safe-area inset so it isn't obscured on notched phones.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-faint/15 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <ul className="flex">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs',
                  active ? 'text-brand-600' : 'text-ink-faint',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
