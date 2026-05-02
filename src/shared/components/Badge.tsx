/**
 * Badge — small label / pill.
 * Source: Tasks/DESIGN_SYSTEM.md §4.5.
 *
 * Tones map onto the design system's semantic ramps:
 *   success → success ramp · warning → gold · danger → terra · info → teal
 *   neutral → ink · brand → teal · accent → per-app accent.
 *
 * Use a `dot` for "live" statuses (in-review, pending). Terminal states have
 * no dot. Width: pill, padding 2px 10px, 11px medium.
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export type BadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'brand'
  | 'accent';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Render a live indicator dot at the start. */
  dot?: boolean;
  /** Optional icon at the start. */
  icon?: ReactNode;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  success:  'bg-success-bg text-success',
  warning:  'bg-gold-50 text-gold-700',
  danger:   'bg-terra-50 text-terra-700',
  info:     'bg-teal-50 text-teal-700',
  neutral:  'bg-ink-100 text-ink-700',
  brand:    'bg-teal-50 text-teal-700',
  accent:   'text-white',
};

export function Badge({
  tone = 'neutral',
  dot,
  icon,
  className,
  children,
  style,
  ...rest
}: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-2xs font-medium leading-none whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
      style={tone === 'accent' ? { background: 'var(--accent-500)', ...style } : style}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: 'currentColor' }}
        />
      )}
      {icon}
      {children}
    </span>
  );
}
