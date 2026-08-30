import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';

/**
 * Every stat card must answer a business question (Master Prompt §59) —
 * always pass a concrete label + value, never a vanity number without
 * context.
 */
export function StatCard({
  label,
  value,
  sublabel,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold', toneClass)}>{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-ink-muted">{sublabel}</p>}
    </Card>
  );
}
