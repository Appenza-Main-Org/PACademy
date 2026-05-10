/**
 * AccountStatusToggle — segmented control for `accountStatus`.
 *
 * Two states: Active (نشط) / Inactive (غير نشط). Active highlights
 * with the per-app accent (teal-500 in the admin surface); Inactive
 * uses muted ink. Buttons are radio-style for keyboard navigation.
 */

import { CheckCircle2, MinusCircle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { AccountStatus } from '@/shared/types/domain';

interface AccountStatusToggleProps {
  value: AccountStatus;
  onChange: (next: AccountStatus) => void;
  disabled?: boolean;
  label?: string;
  helper?: string;
  className?: string;
}

const OPTIONS: ReadonlyArray<{ value: AccountStatus; label: string }> = [
  { value: 'active', label: 'نشط' },
  { value: 'inactive', label: 'غير نشط' },
];

export function AccountStatusToggle({
  value,
  onChange,
  disabled,
  label = 'حالة الحساب',
  helper,
  className,
}: AccountStatusToggleProps): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <span className="text-sm font-medium text-ink-700">{label}</span>}
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex w-fit overflow-hidden rounded-md border border-border-default bg-surface-card"
      >
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          const isActive = opt.value === 'active';
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-standard',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
                selected && isActive && 'bg-teal-500 text-white',
                selected && !isActive && 'bg-ink-200 text-ink-900',
                !selected && 'text-ink-600 hover:bg-ink-50',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {isActive ? (
                <CheckCircle2 size={14} strokeWidth={2} />
              ) : (
                <MinusCircle size={14} strokeWidth={2} />
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
      {helper && <span className="text-2xs text-ink-500">{helper}</span>}
    </div>
  );
}
