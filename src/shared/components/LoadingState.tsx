/**
 * LoadingState — first-class loading composition.
 * Source: Tasks/DESIGN_SYSTEM.md §4.10.
 *
 * Provides skeleton boxes mirroring real layouts (table rows, cards, KPI
 * strips) instead of a bare spinner. A spinner is used only for short
 * (<300ms) layouts via the `mode="spinner"` prop.
 *
 * Usage:
 *   <LoadingState variant="table" rows={8} />
 *   <LoadingState variant="card-grid" count={4} />
 *   <LoadingState variant="kpi" />
 *   <LoadingState variant="page" />
 *   <LoadingState mode="spinner" />
 */

import { cn } from '@/shared/lib/cn';
import { Skeleton } from './Skeleton';

export type LoadingVariant = 'table' | 'card-grid' | 'kpi' | 'page' | 'detail' | 'list';

interface LoadingStateProps {
  variant?: LoadingVariant;
  /** Number of rows for table / count for card-grid. */
  rows?: number;
  count?: number;
  mode?: 'skeleton' | 'spinner';
  className?: string;
  /** Accessible label for screen readers. Defaults to "جارٍ التحميل…". */
  label?: string;
}

export function LoadingState({
  variant = 'table',
  rows = 8,
  count = 4,
  mode = 'skeleton',
  className,
  label = 'جارٍ التحميل…',
}: LoadingStateProps): JSX.Element {
  if (mode === 'spinner') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('flex items-center justify-center gap-3 py-9 text-ink-500', className)}
      >
        <Spinner />
        <span className="text-sm">{label}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('animate-pulse-none', className)}
    >
      <span className="sr-only">{label}</span>
      {variant === 'table' && <TableSkeleton rows={rows} />}
      {variant === 'card-grid' && <CardGridSkeleton count={count} />}
      {variant === 'kpi' && <KpiSkeleton />}
      {variant === 'list' && <ListSkeleton rows={rows} />}
      {variant === 'detail' && <DetailSkeleton />}
      {variant === 'page' && <PageSkeleton />}
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-card">
      <div className="flex gap-4 border-b border-border-subtle bg-surface-sunken p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={12} width="14%" />
        ))}
      </div>
      <div className="flex flex-col">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-border-subtle p-4 last:border-b-0">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} height={14} width="14%" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CardGridSkeleton({ count }: { count: number }): JSX.Element {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border-subtle bg-surface-card p-5">
          <Skeleton height={48} width={48} className="mb-4 rounded-md" />
          <Skeleton height={16} width="70%" className="mb-2" />
          <Skeleton height={12} width="100%" className="mb-1" />
          <Skeleton height={12} width="85%" />
        </div>
      ))}
    </div>
  );
}

function KpiSkeleton(): JSX.Element {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border-subtle bg-surface-card p-5">
          <Skeleton height={12} width="60%" className="mb-3" />
          <Skeleton height={28} width="50%" className="mb-2" />
          <Skeleton height={10} width="40%" />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton height={36} width={36} className="rounded-full" />
          <div className="flex-1">
            <Skeleton height={12} width="60%" className="mb-2" />
            <Skeleton height={10} width="40%" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton(): JSX.Element {
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
      <div className="rounded-lg border border-border-subtle bg-surface-card p-6">
        <Skeleton height={24} width="40%" className="mb-5" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[140px_1fr] gap-4">
              <Skeleton height={12} />
              <Skeleton height={12} width="80%" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border-subtle bg-surface-card p-6">
        <Skeleton height={20} width="50%" className="mb-4" />
        <SkeletonStack rows={4} />
      </div>
    </div>
  );
}

function PageSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton height={28} width="30%" className="mb-2" />
        <Skeleton height={14} width="50%" />
      </div>
      <KpiSkeleton />
      <TableSkeleton rows={6} />
    </div>
  );
}

function SkeletonStack({ rows }: { rows: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={14} width={`${100 - i * 10}%`} />
      ))}
    </div>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden role="presentation">
      <circle cx={12} cy={12} r={10} fill="none" stroke="var(--ink-200)" strokeWidth={2} />
      <path
        d="M12 2 a10 10 0 0 1 10 10"
        fill="none"
        stroke="var(--teal-500)"
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
