/**
 * Input — text-style form control.
 * Source: Tasks/DESIGN_SYSTEM.md §4.2.
 *
 * Height: 36px default, 28px in dense tables.
 * Border 1px border-default → border-strong on hover → 1px border-focus + 3px teal ring on focus.
 * Required marker: terra-500 asterisk after label. Helper / Error swap below the input.
 */

import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  helper?: ReactNode;
  /** Backwards-compat alias of `helper`. */
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Density preset; defaults to default (36px). */
  density?: 'default' | 'compact';
  /** Optional icon shown at the start of the input. */
  leadingIcon?: ReactNode;
  /** Optional icon shown at the end of the input. */
  trailingIcon?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helper,
      help,
      error,
      required,
      density = 'default',
      leadingIcon,
      trailingIcon,
      containerClassName,
      className,
      id,
      ...rest
    },
    ref,
  ) => {
    const inputId = id ?? `field-${rest.name ?? Math.random().toString(36).slice(2, 7)}`;
    const helperText = error ?? helper ?? help;
    const helperTone = error ? 'text-terra-700' : 'text-ink-500';
    return (
      <div className={cn('flex flex-col gap-1', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
            {label}
            {required && <span className="ms-1 text-terra-500">*</span>}
          </label>
        )}
        <div className="relative">
          {leadingIcon && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 inset-inline-start-0 flex items-center px-3 text-ink-400"
            >
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error) || undefined}
            className={cn(
              'block w-full rounded-md border bg-surface-card text-sm text-ink-900 transition-colors duration-fast ease-standard',
              density === 'compact' ? 'h-7 text-xs' : 'h-9',
              leadingIcon ? 'ps-9 pe-3' : 'px-3',
              trailingIcon && 'pe-9',
              'placeholder:text-ink-400',
              error
                ? 'border-terra-500 focus-visible:border-terra-500 focus-visible:shadow-focus-terra'
                : 'border-ink-200 hover:border-ink-300 focus-visible:border-teal-500 focus-visible:shadow-focus-teal',
              'focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
              className,
            )}
            {...rest}
          />
          {trailingIcon && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 inset-inline-end-0 flex items-center px-3 text-ink-400"
            >
              {trailingIcon}
            </span>
          )}
        </div>
        {helperText && <span className={cn('text-xs', helperTone)}>{helperText}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';

/* Textarea — same visual contract; multi-line. */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helper, error, required, className, containerClassName, id, ...rest }, ref) => {
    const inputId = id ?? `ta-${rest.name ?? Math.random().toString(36).slice(2, 7)}`;
    const helperText = error ?? helper;
    const helperTone = error ? 'text-terra-700' : 'text-ink-500';
    return (
      <div className={cn('flex flex-col gap-1', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
            {label}
            {required && <span className="ms-1 text-terra-500">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          className={cn(
            'block w-full resize-y rounded-md border bg-surface-card px-3 py-2 text-sm text-ink-900 transition-colors duration-fast ease-standard',
            'min-h-[88px] leading-normal',
            'placeholder:text-ink-400',
            error
              ? 'border-terra-500 focus-visible:border-terra-500 focus-visible:shadow-focus-terra'
              : 'border-ink-200 hover:border-ink-300 focus-visible:border-teal-500 focus-visible:shadow-focus-teal',
            'focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
            className,
          )}
          {...rest}
        />
        {helperText && <span className={cn('text-xs', helperTone)}>{helperText}</span>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
