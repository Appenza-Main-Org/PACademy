import { cn } from '@/shared/lib/cn';
import { initials } from '@/shared/lib/format';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, size = 'md', className }: AvatarProps): JSX.Element {
  return (
    <div
      className={cn(
        'avatar',
        size === 'sm' && 'avatar-sm',
        size === 'lg' && 'avatar-lg',
        className,
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
