/**
 * Avatar — circle avatar with Arabic-letter fallback.
 * Source: Tasks/DESIGN_SYSTEM.md (composite usage in §4.14 Sidebar footer).
 *
 * Sizes: sm (28px) · md (36px) · lg (48px) · xl (64px). Uses the per-app
 * accent so avatars in app shells track their context.
 */

import { cn } from '@/shared/lib/cn';
import { initials } from '@/shared/lib/format';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  src?: string;
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-7 w-7 text-2xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export function Avatar({ name, size = 'md', src, className }: AvatarProps): JSX.Element {
  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded-pill font-medium text-white',
        SIZE_CLASS[size],
        className,
      )}
      style={{
        background:
          'linear-gradient(135deg, var(--accent-500), color-mix(in srgb, var(--accent-500) 70%, var(--ink-900)))',
        backgroundImage: src ? `url(${src})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {!src && initials(name)}
    </div>
  );
}
