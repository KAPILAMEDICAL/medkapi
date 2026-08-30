'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function TopBar({
  displayName,
  role,
  mobileNav,
}: {
  displayName: string;
  role: string;
  mobileNav?: React.ReactNode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-faint/15 bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        {mobileNav && (
          <button
            className="md:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu size={20} />
          </button>
        )}
        <div>
          <p className="text-sm font-medium text-ink">{displayName}</p>
          <p className="text-xs text-ink-faint">{role.replace(/_/g, ' ')}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
        <LogOut size={16} />
        <span className="hidden sm:inline">Log out</span>
      </Button>
      {menuOpen && mobileNav && (
        <div className="absolute left-0 right-0 top-full border-b border-ink-faint/15 bg-surface p-2 md:hidden">
          {mobileNav}
        </div>
      )}
    </header>
  );
}
