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
          style={{
            boxShadow: 'inset 0 1px 2px rgba(28, 25, 15, 0.18)',
          }}
          className={cn(
            'group relative inline-block h-5 w-9 shrink-0 cursor-pointer rounded-full',
            'border border-ink-400 bg-ink-300',
            'transition-colors duration-fast ease-standard',
            'hover:bg-ink-400',
            'data-[state=checked]:bg-accent-500 data-[state=checked]:border-accent-700',
            'data-[state=checked]:hover:bg-accent-600',
            'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
            'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
            'motion-reduce:transition-none',
          )}
          {...rest}
        >
          <RadixSwitch.Thumb
            className={cn(
              'absolute top-1/2 block h-4 w-4 -translate-y-1/2 rounded-full bg-white',
              'shadow-md ring-1 ring-ink-400/40',
              'start-0.5 data-[state=checked]:start-[18px]',
              'transition-[inset-inline-start] duration-fast ease-standard',
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
