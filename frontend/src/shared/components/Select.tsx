/**
 * Select — native HTML select with Heritage Modern styling.
 * Source: Tasks/DESIGN_SYSTEM.md §4.2.
 *
 * For searchable / virtualised pickers use <Combobox /> instead. Native select
 * is preferred when the option set is small (<10) and discoverability isn't a
 * concern.
 */

import { forwardRef } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { dropdownChevronClassName, dropdownTriggerClassName } from './dropdownStyles';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  options: ReadonlyArray<{ value: string; label: string }>;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, helper, error, required, options, className, containerClassName, id, ...rest },
    ref,
  ) => {
    const selectId = id ?? `select-${rest.name ?? Math.random().toString(36).slice(2, 7)}`;
    const helperText = error ?? helper;
    const helperTone = error ? 'text-terra-700' : 'text-ink-500';
    return (
      <div className={cn('flex flex-col gap-1', containerClassName)}>
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-ink-700">
            {label}
            {required && <span className="ms-1 text-terra-500">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={Boolean(error) || undefined}
            className={cn('appearance-none', dropdownTriggerClassName({ invalid: Boolean(error), className }))}
            {...rest}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            className={dropdownChevronClassName()}
            aria-hidden
          />
        </div>
        {helperText && <span className={cn('text-xs', helperTone)}>{helperText}</span>}
      </div>
    );
  },
);

Select.displayName = 'Select';
