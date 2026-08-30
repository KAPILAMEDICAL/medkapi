import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  brand: 'bg-brand-100 text-brand-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium', toneClasses[tone])}>
      {children}
    </span>
  );
}

const ORDER_STATUS_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  BOOKED: 'info',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  PACKED: 'warning',
  DISPATCHED: 'brand',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  RETURNED: 'danger',
};

const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  PENDING: 'warning',
  RECEIVED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
  CLEARED: 'success',
  BOUNCED: 'danger',
};

const EXPENSE_STATUS_TONE: Record<string, Tone> = {
  PENDING: 'warning',
  CORRECTION_REQUESTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  REIMBURSED: 'brand',
};

export function StatusBadge({ status, kind }: { status: string; kind: 'order' | 'payment' | 'expense' }) {
  const map = kind === 'order' ? ORDER_STATUS_TONE : kind === 'payment' ? PAYMENT_STATUS_TONE : EXPENSE_STATUS_TONE;
  return <Badge tone={map[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>;
}
