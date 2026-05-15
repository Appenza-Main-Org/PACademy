/**
 * Switch — boolean toggle (on/off).
 *
 * Built on `@radix-ui/react-switch`. For yes/no settings, isActive
 * toggles in tables, feature flags, anywhere a binary state benefits
 * from the visual flip of a track + thumb rather than a checkbox.
 *
 * Use Checkbox for selection in lists; use Switch for state.
 *
 * Behaviour
 * ---------
 *  • Space / Enter toggles
 *  • focus ring uses --ring
 *  • prefers-reduced-motion respected on the thumb slide
 *  • RTL-safe — track is direction-neutral; the thumb starts on the
 *    logical start edge and slides to the logical end edge on `on`
 *
 * Composition
 * -----------
 *   <Switch checked={isActive} onCheckedChange={setActive} label="مفعّل" />
 */

import * as RadixSwitch from '@radix-ui/react-switch';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

type RadixProps = ComponentPropsWithoutRef<typeof RadixSwitch.Root>;

export interface SwitchProps extends Omit<RadixProps, 'children'> {
  /** Visible label rendered next to the switch. */
  label?: ReactNode;
  /** Helper text below the switch. */
  helper?: ReactNode;
}

export const Switch = forwardRef<ElementRef<typeof RadixSwitch.Root>, SwitchProps>(
  ({ label, helper, className, id, ...rest }, ref) => {
    const generatedId = `switch-${Math.random().toString(36).slice(2, 8)}`;
    const inputId = id ?? generatedId;
    return (
      <span className={cn('inline-flex items-center gap-3', className)}>
        <RadixSwitch.Root
          ref={ref}
          id={inputId}
          className={cn(
            'group inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
            'border border-border-subtle bg-ink-100',
            'transition-colors duration-fast ease-standard',
            'data-[state=checked]:bg-accent-500 data-[state=checked]:border-accent-500',
            'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
            'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
            'motion-reduce:transition-none',
          )}
          {...rest}
        >
          <RadixSwitch.Thumb
            className={cn(
              'block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5',
              'transition-transform duration-fast ease-standard',
              'translate-x-0.5 data-[state=checked]:translate-x-[1.375rem]',
              'rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[1.375rem]',
              'motion-reduce:transition-none',
            )}
          />
        </RadixSwitch.Root>
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
Switch.displayName = 'Switch';
