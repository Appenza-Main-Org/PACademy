/**
 * RadixSelect — Heritage-Modern styled wrapper around
 * `@radix-ui/react-select`.
 *
 * Use this for short, closed option sets (≤ ~10 entries) where the
 * SearchSelect's filter input would be wasted ergonomics. For larger or
 * type-ahead-friendly lists pick `<SearchSelect />` instead.
 *
 * Trigger chrome mirrors `<Input>` (h-9 default, terra/teal focus rings,
 * disabled state) so a `<RadixSelect>` and `<Input>` placed side-by-side
 * read as a single field-row.
 *
 * Usage
 * -----
 *   <RadixSelect
 *     value={op}
 *     onChange={setOp}
 *     options={OPERATORS}
 *     ariaLabel="عملية المقارنة"
 *   />
 */

import * as RadixSelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import {
  dropdownChevronClassName,
  dropdownContentClassName,
  dropdownOptionClassName,
  dropdownTriggerClassName,
} from './dropdownStyles';

export interface RadixSelectOption<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

interface RadixSelectProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<RadixSelectOption<V>>;
  /** Required when there's no visible label associated with the trigger. */
  ariaLabel?: string;
  disabled?: boolean;
  /** Render the trigger in error chrome (matches Input's `error` state). */
  invalid?: boolean;
  /** Class names merged onto the trigger element. */
  className?: string;
  /** Placeholder text shown when `value` matches no option. */
  placeholder?: string;
}

export function RadixSelect<V extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
  invalid,
  className,
  placeholder = 'اختر…',
}: RadixSelectProps<V>): JSX.Element {
  return (
    <RadixSelectPrimitive.Root
      value={value}
      onValueChange={(next) => onChange(next as V)}
      disabled={disabled}
      dir="rtl"
    >
      <RadixSelectPrimitive.Trigger
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={dropdownTriggerClassName({ invalid, className })}
      >
        <span className="min-w-0 flex-1 truncate">
          <RadixSelectPrimitive.Value placeholder={placeholder} />
        </span>
        <RadixSelectPrimitive.Icon asChild>
          <ChevronDown size={16} aria-hidden className={dropdownChevronClassName()} />
        </RadixSelectPrimitive.Icon>
      </RadixSelectPrimitive.Trigger>

      <RadixSelectPrimitive.Portal>
        <RadixSelectPrimitive.Content
          position="popper"
          sideOffset={4}
          align="start"
          className={cn('z-dropdown p-1', dropdownContentClassName())}
          style={{
            animation: 'pageEnter var(--duration-fast) var(--ease-standard)',
            minWidth: 'var(--radix-select-trigger-width)',
            maxHeight: 'var(--radix-select-content-available-height)',
          }}
        >
          <RadixSelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <RadixSelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={dropdownOptionClassName({
                  className:
                    'relative pe-8 data-[highlighted]:bg-[var(--accent-50)] data-[highlighted]:outline-none data-[state=checked]:font-medium data-[state=checked]:text-ink-900 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
                })}
              >
                <RadixSelectPrimitive.ItemText>{opt.label}</RadixSelectPrimitive.ItemText>
                <RadixSelectPrimitive.ItemIndicator className="absolute end-2 inline-flex items-center">
                  <Check size={14} aria-hidden className="text-[var(--accent-600)]" />
                </RadixSelectPrimitive.ItemIndicator>
              </RadixSelectPrimitive.Item>
            ))}
          </RadixSelectPrimitive.Viewport>
        </RadixSelectPrimitive.Content>
      </RadixSelectPrimitive.Portal>
    </RadixSelectPrimitive.Root>
  );
}
