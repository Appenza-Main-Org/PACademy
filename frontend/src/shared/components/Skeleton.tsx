/**
 * Skeleton — base skeleton block used by LoadingState and consumers.
 * Source: Tasks/DESIGN_SYSTEM.md §4.10.
 *
 * Animated via the `.skeleton` keyframe defined in motifs.css; reduced motion
 * users get a static block.
 */

import { cn } from '@/shared/lib/cn';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, width, height }: SkeletonProps): JSX.Element {
  return (
    <div className={cn('skeleton', className)} style={{ width, height }} aria-hidden />
  );
}

export function SkeletonRow({ count = 5 }: { count?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={14} />
      ))}
    </div>
  );
}
