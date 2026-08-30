import { InputHTMLAttributes, forwardRef, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  id: string;
}

const fieldBase =
  'w-full rounded-md border border-ink-faint/40 bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-surface-muted';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrapperProps>(
  ({ label, error, hint, id, className, ...props }, ref) => (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        className={cn(fieldBase, error && 'border-danger focus:border-danger focus:ring-danger', className)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapperProps>(
  ({ label, error, hint, id, className, ...props }, ref) => (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <textarea id={id} ref={ref} className={cn(fieldBase, 'min-h-[90px]', className)} {...props} />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldWrapperProps>(
  ({ label, error, id, className, children, ...props }, ref) => (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <select id={id} ref={ref} className={cn(fieldBase, 'bg-surface', className)} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';
