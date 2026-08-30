import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function TableContainer({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-md border border-ink-faint/15 bg-surface">{children}</div>;
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full min-w-[640px] text-left text-sm', className)} {...props} />;
}

export function Thead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-subtle text-xs uppercase tracking-wide text-ink-faint', className)} {...props} />;
}

export function Th({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-2.5 font-medium', className)} {...props} />;
}

export function Td({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-t border-ink-faint/10 px-4 py-3 text-ink', className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-surface-subtle/60', className)} {...props} />;
}
