/**
 * ExcellenceModeToggle — compact two-option selector for «معيار التمييز».
 *
 * Prop contract:
 *   value: selected criterion branch (`GRADES` = درجة, `TAGDIR` = تقدير)
 *   onChange: receives the next selected branch
 *
 * Usage:
 *   <ExcellenceModeToggle value={draft.excellenceMode} onChange={setMode} />
 */

import { cn } from '@/shared/lib/cn';
import type { ExcellenceMode } from '../../lib/excellenceMode';

interface ExcellenceModeToggleProps {
  value: ExcellenceMode;
  onChange: (next: ExcellenceMode) => void;
  disabled?: boolean;
}

const OPTIONS: ReadonlyArray<{ value: ExcellenceMode; label: string }> = [
  { value: 'GRADES', label: 'درجة' },
  { value: 'TAGDIR', label: 'تقدير' },
];

export function ExcellenceModeToggle({
  value,
  onChange,
  disabled = false,
}: ExcellenceModeToggleProps): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="معيار التمييز"
      className="inline-flex rounded-md border border-border-default bg-surface-card p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-9 min-w-20 rounded-sm px-3 text-sm font-medium transition-colors duration-fast ease-standard',
              'focus-visible:outline-none focus-visible:shadow-focus-teal',
              disabled && 'cursor-not-allowed opacity-60',
              selected
                ? 'bg-teal-600 text-white shadow-sm'
                : cn(
                    'bg-transparent text-ink-700',
                    !disabled && 'hover:bg-ink-50 hover:text-ink-900',
                  ),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
