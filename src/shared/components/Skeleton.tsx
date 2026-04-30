import { cn } from '@/shared/lib/cn';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, width, height }: SkeletonProps): JSX.Element {
  return <div className={cn('skeleton', className)} style={{ width, height }} aria-hidden />;
}

export function SkeletonRow({ count = 5 }: { count?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={18} />
      ))}
    </div>
  );
}
