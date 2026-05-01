/**
 * CenteredShell — max-width content container.
 * Source: Tasks/DESIGN_SYSTEM.md Sprint 0 Part C.
 */

import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface CenteredShellProps {
  children: ReactNode;
  /** Max content width key. Defaults to "wide" (1280px). */
  size?: 'narrow' | 'default' | 'wide';
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<CenteredShellProps['size']>, string> = {
  narrow: 'max-w-[720px]',
  default: 'max-w-[1024px]',
  wide: 'max-w-[1280px]',
};

export function CenteredShell({
  children,
  size = 'wide',
  className,
}: CenteredShellProps): JSX.Element {
  return <div className={cn('mx-auto w-full', SIZE_CLASS[size], className)}>{children}</div>;
}
