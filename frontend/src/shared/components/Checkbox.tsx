/**
 * Checkbox — selection control for lists and matrices.
 *
 * Built on `@radix-ui/react-checkbox`. For multi-select lists, mapping
 * matrices, bulk-action confirmations. Use `Switch` instead when the
 * value represents stateful on/off (isActive, isLive).
 *
 * Behaviour
 * ---------
 *  • Space toggles
 *  • supports 'indeterminate' state (Radix `checked="indeterminate"`)
 *  • focus ring uses --ring
 *  • Arabic copy alignment via logical properties
 *
 * Composition
 * -----------
 *   <Checkbox checked={selected} onCheckedChange={setSelected} label="…" />
 */

import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

type RadixProps = ComponentPropsWithoutRef<typeof RadixCheckbox.Root>;

export interface CheckboxProps extends Omit<RadixProps, 'children'> {
  label?: ReactNode;
  helper?: ReactNode;
}

export const Checkbox = forwardRef<ElementRef<typeof RadixCheckbox.Root>, CheckboxProps>(
  ({ label, helper, className, id, checked, ...rest }, ref) => {
    const generatedId = `checkbox-${Math.random().toString(36).slice(2, 8)}`;
    const inputId = id ?? generatedId;
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <RadixCheckbox.Root
          ref={ref}
          id={inputId}
          checked={checked}
          className={cn(
            'group flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded',
            'border border-border-strong bg-surface',
            'transition-colors duration-fast ease-standard',
            'data-[state=checked]:bg-accent-500 data-[state=checked]:border-accent-500',
            'data-[state=indeterminate]:bg-accent-500 data-[state=indeterminate]:border-accent-500',
            'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
            'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          )}
          {...rest}
        >
          <RadixCheckbox.Indicator>
            {checked === 'indeterminate' ? (
              <Minus size={12} className="text-surface" />
            ) : (
              <Check size={12} className="text-surface" />
            )}
          </RadixCheckbox.Indicator>
        </RadixCheckbox.Root>
        {label && (
          <label
            htmlFor={inputId}
            className="select-none text-sm text-ink-800 font-ar cursor-pointer"
          >
            {label}
            {helper && <span className="ms-2 text-2xs text-ink-500">{helper}</span>}
          </label>
        )}
      </span>
    );
  },
);
Checkbox.displayName = 'Checkbox';
