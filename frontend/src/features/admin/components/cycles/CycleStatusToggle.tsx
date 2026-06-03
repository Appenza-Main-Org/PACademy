/**
 * CycleStatusToggle — two-option selector for the admission-cycle state.
 *
 * Props:
 * - `value`: current list-facing cycle status.
 * - `onChange`: called when the admin picks the other state.
 * - `disabled`: locks both options while a mutation is pending.
 *
 * Example:
 *   <CycleStatusToggle value="review" onChange={setStatus} />
 */

import { CheckCircle2, FilePenLine } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { CycleListStatus } from './cycleListStatus';
import { LIST_STATUS_LABEL, LIST_STATUS_OPTIONS } from './cycleListStatus';

interface CycleStatusToggleProps {
  value: CycleListStatus;
  onChange: (next: CycleListStatus) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function CycleStatusToggle({
  value,
  onChange,
  disabled,
  ariaLabel = 'حالة الدورة',
  className,
}: CycleStatusToggleProps): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex w-fit overflow-hidden rounded-md border border-border-default bg-surface-card',
        className,
      )}
    >
      {LIST_STATUS_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        const published = opt.value === 'published';
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex h-9 min-w-[7rem] items-center justify-center gap-1.5 px-3 text-xs font-semibold',
              'transition-colors duration-fast ease-standard',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1',
              selected && published && 'bg-teal-500 text-white',
              selected && !published && 'bg-ink-200 text-ink-900',
              !selected && 'text-ink-600 hover:bg-ink-50',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {published ? (
              <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
            ) : (
              <FilePenLine size={14} strokeWidth={2} aria-hidden />
            )}
            {LIST_STATUS_LABEL[opt.value]}
          </button>
        );
      })}
    </div>
  );
}
