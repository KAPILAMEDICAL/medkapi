'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NavItem } from '@/components/nav/BottomNav';

export function Sidebar({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-ink-faint/15 bg-surface md:flex md:flex-col">
      <div className="px-4 py-4">
        <p className="text-sm font-semibold text-ink">Kapila Medical Agencies</p>
        <p className="text-xs text-ink-faint">{title}</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-2" aria-label="Admin navigation">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon: LucideIcon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                active ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-surface-subtle',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
