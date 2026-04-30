import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' | 'accent';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ tone = 'neutral', dot, className, children, ...rest }: BadgeProps): JSX.Element {
  return (
    <span className={cn('badge', `badge-${tone}`, dot && 'badge-dot', className)} {...rest}>
      {children}
    </span>
  );
}
