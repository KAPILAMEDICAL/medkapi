import { ReactNode } from 'react';

/**
 * Every empty state must name the next useful action (Master Prompt §47) —
 * "No orders yet" alone is a dead end, so `action` is intentionally not
 * optional in spirit even though it's typed as such for one-off cases.
 */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-ink-faint/30 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
