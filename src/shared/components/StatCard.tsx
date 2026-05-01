/**
 * StatCard — KPI card variant of <Card> per §4.3.
 * 16px label + 28px medium number + optional trend + optional sparkline.
 */

import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { num } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { Sparkline } from './charts/Sparkline';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: { label: string; direction?: 'up' | 'down'; tone?: 'success' | 'danger' | 'neutral' };
  /** Sparkline tail data — auto-uses accent colour. */
  sparkline?: readonly number[];
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  trend,
  sparkline,
  className,
}: StatCardProps): JSX.Element {
  const trendTone = trend?.tone ?? (trend?.direction === 'down' ? 'danger' : 'success');
  return (
    <article
      className={cn(
        'flex flex-col rounded-lg border border-border-subtle bg-surface-card p-5 shadow-xs',
        'transition-shadow duration-fast ease-standard hover:shadow-sm',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <span className="text-xs text-ink-500">{label}</span>
        {icon && (
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-md"
            style={{
              background: iconBg ?? 'var(--accent-50)',
              color: iconColor ?? 'var(--accent-600)',
            }}
          >
            {icon}
          </span>
        )}
      </header>
      <p className="mt-2 text-2xl font-bold font-numeric tnum leading-tight text-ink-900">
        {typeof value === 'number' ? num(value) : value}
      </p>
      <footer className="mt-2 flex items-center justify-between gap-3">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              trendTone === 'success' && 'text-success',
              trendTone === 'danger' && 'text-terra-700',
              trendTone === 'neutral' && 'text-ink-500',
            )}
          >
            {trend.direction === 'down' ? (
              <ArrowDownRight size={12} strokeWidth={2} aria-hidden />
            ) : (
              <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
            )}
            {trend.label}
          </span>
        ) : (
          <span aria-hidden />
        )}
        {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} />}
      </footer>
    </article>
  );
}
