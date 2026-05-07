/**
 * KhayameyaStripe — horizontal multi-color heritage stripe.
 * Source: Tasks/DESIGN_SYSTEM.md §3.2.
 *
 * Width breakdown (always exact): 30% teal · 20% gold · 6% terra · 44% ink-700.
 *
 * Used as:
 *  - Top border of AppShell header (3px tall, sm)
 *  - Top of Decision document / Board sessions header (6px tall, md)
 *  - Bottom of certificate-style printables (12px tall, lg)
 *
 * Usage:
 *   <KhayameyaStripe height="sm" />
 */

import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';

export type KhayameyaHeight = 'sm' | 'md' | 'lg' | number;

interface KhayameyaStripeProps {
  height?: KhayameyaHeight;
  className?: string;
  style?: CSSProperties;
}

const HEIGHT_PX: Record<Exclude<KhayameyaHeight, number>, number> = {
  sm: 3,
  md: 6,
  lg: 12,
};

export function KhayameyaStripe({
  height = 'sm',
  className,
  style,
}: KhayameyaStripeProps): JSX.Element {
  const px = typeof height === 'number' ? height : HEIGHT_PX[height];
  return (
    <div
      aria-hidden
      role="presentation"
      data-no-print="true"
      className={cn('w-full', className)}
      style={{
        height: `${px}px`,
        background:
          'linear-gradient(to inline-end, ' +
          'var(--teal-500)  0%,  var(--teal-500)  30%, ' +
          'var(--gold-500)  30%, var(--gold-500)  50%, ' +
          'var(--terra-500) 50%, var(--terra-500) 56%, ' +
          'var(--ink-700)   56%, var(--ink-700)   100%)',
        ...style,
      }}
    />
  );
}
