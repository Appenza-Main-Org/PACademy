/**
 * Card — surface container.
 * Source: Tasks/DESIGN_SYSTEM.md §4.3.
 *
 * Variants:
 *  - default — bg surface-card, 1px border-subtle, radius lg, padding 20px,
 *              shadow-xs at rest, shadow-sm on hover (when interactive).
 *  - stat    — KPI card; consumer composes via <StatCard />.
 *  - feature — hub-page app card; 24px padding, accent border-top 3px.
 *  - compact — 12px padding, 13px text, dense lists.
 *  - elevated — shadow-sm at rest, shadow-md on hover, primary CTA grouping.
 *
 * Cards never have gradients or coloured backgrounds outside of
 * `--surface-card`, `--surface-sunken`, or a 50-stop tint at 40% alpha.
 */

import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export type CardVariant = 'default' | 'feature' | 'compact' | 'elevated';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** When true, the card responds to hover/focus as a surface. */
  interactive?: boolean;
  /** Apply 3px top accent border (used by feature variant by default). */
  withAccentBorder?: boolean;
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default:  'bg-surface-card border border-border-subtle rounded-lg p-5 shadow-xs',
  feature:  'bg-surface-card border border-border-subtle rounded-lg p-6 shadow-xs',
  compact:  'bg-surface-card border border-border-subtle rounded-lg p-3 text-sm shadow-xs',
  elevated: 'bg-surface-card border border-border-subtle rounded-lg p-5 shadow-sm',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', interactive, withAccentBorder, className, style, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        VARIANT_CLASS[variant],
        'transition-shadow duration-fast ease-standard',
        interactive && 'cursor-pointer hover:shadow-sm focus-within:shadow-focus-teal',
        variant === 'elevated' && interactive && 'hover:shadow-md',
        (variant === 'feature' || withAccentBorder) && 'relative overflow-hidden',
        className,
      )}
      style={style}
      {...rest}
    >
      {(variant === 'feature' || withAccentBorder) && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: 'var(--accent-500)' }}
        />
      )}
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

interface CardHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, actions, className }: CardHeaderProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 -mx-5 -mt-5 mb-4 border-b border-border-subtle px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {title && <h3 className="truncate text-md font-bold text-ink-900">{title}</h3>}
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn('text-sm text-ink-900', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        '-mx-5 -mb-5 mt-4 border-t border-border-subtle bg-ink-50 px-5 py-3 text-xs text-ink-500',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
