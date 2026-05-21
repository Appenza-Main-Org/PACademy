/**
 * Button — primary interactive primitive.
 * Source: Tasks/DESIGN_SYSTEM.md §4.1.
 *
 * Variants: primary · secondary · ghost · danger · success.
 * Sizes:    sm (28px) · md (36px, default) · lg (44px) · xl (52px, hero only) · icon.
 * States:   default · hover · active · focus-visible · disabled · loading.
 *
 * Loading: replace icon with 14px spinner, keep label.
 * Icons: 16px (md), 8px gap, color inherits.
 */

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'accent';
type Size = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

interface ButtonClassNameOptions {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
}

const SIZE_CLASS: Record<Size, string> = {
  sm:   'h-7 px-3 text-xs',
  md:   'h-9 px-4 text-sm',
  lg:   'h-11 px-5 text-sm',
  xl:   'h-13 px-7 text-md',
  icon: 'h-9 w-9 p-0',
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-teal-500 text-white shadow-xs hover:bg-teal-600 active:bg-teal-700 ' +
    'disabled:bg-teal-200 disabled:text-white/60 ' +
    'focus-visible:shadow-focus-teal',
  secondary:
    'bg-surface-card text-ink-900 border border-border-default ' +
    'hover:bg-ink-50 hover:border-border-strong ' +
    'disabled:opacity-50 ' +
    'focus-visible:shadow-focus-teal focus-visible:border-teal-500',
  ghost:
    'bg-transparent text-teal-600 hover:bg-teal-50 ' +
    'disabled:opacity-50 ' +
    'focus-visible:shadow-focus-teal',
  danger:
    'bg-terra-500 text-white shadow-xs hover:bg-terra-600 active:bg-terra-700 ' +
    'disabled:bg-terra-200 disabled:text-white/60 ' +
    'focus-visible:shadow-focus-terra',
  success:
    'bg-success text-white shadow-xs hover:opacity-90 ' +
    'disabled:opacity-50 ' +
    'focus-visible:shadow-focus-teal',
  /* `accent` uses the per-app accent variable so it tracks data-app context. */
  accent:
    'text-white shadow-xs ' +
    'disabled:opacity-50 ' +
    'focus-visible:shadow-[var(--shadow-focus-accent,var(--shadow-focus-teal))]',
};

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
}: ButtonClassNameOptions = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium font-ar select-none whitespace-nowrap',
    'transition-colors duration-fast ease-standard',
    'focus-visible:outline-none',
    'disabled:cursor-not-allowed',
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    fullWidth && 'w-full',
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      leadingIcon,
      trailingIcon,
      fullWidth,
      isLoading,
      loadingLabel,
      className,
      children,
      disabled,
      type = 'button',
      style,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled ?? isLoading}
      className={buttonClassName({ variant, size, fullWidth, className })}
      style={
        variant === 'accent'
          ? { background: 'var(--accent-500)', ...style }
          : style
      }
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? <Spinner /> : leadingIcon}
      <span className={cn(size === 'icon' && 'sr-only')}>
        {isLoading ? (loadingLabel ?? children ?? 'جارٍ التنفيذ…') : children}
      </span>
      {!isLoading && trailingIcon}
    </button>
  ),
);

Button.displayName = 'Button';

function Spinner(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden role="presentation">
      <circle cx={12} cy={12} r={10} fill="none" stroke="currentColor" strokeWidth={2} opacity={0.25} />
      <path
        d="M12 2 a10 10 0 0 1 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
