import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-surface-muted text-ink hover:bg-ink-faint/20',
  outline: 'border border-ink-faint/40 text-ink bg-surface hover:bg-surface-muted',
  ghost: 'text-ink hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:opacity-90',
};

// Sizes are deliberately generous — the sales team primarily uses this
// with one hand on a phone, so the minimum tap target stays above 44px.
const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-3 py-2 min-h-[36px]',
  md: 'text-sm px-4 py-2.5 min-h-[44px]',
  lg: 'text-base px-5 py-3.5 min-h-[52px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-60',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
