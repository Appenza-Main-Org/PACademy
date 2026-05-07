/**
 * Icon — thin wrapper around lucide-react icons with Heritage Modern defaults.
 * Source: Tasks/DESIGN_SYSTEM.md §5.
 *
 * Default stroke-width 1.75 (per §5 — slightly chunkier than lucide's 2 reads
 * better at small sizes against cream).
 */

import type { LucideIcon, LucideProps } from 'lucide-react';
import { forwardRef } from 'react';

interface IconProps extends LucideProps {
  icon: LucideIcon;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ icon: LucideIconCmp, size = 18, strokeWidth = 1.75, ...rest }, ref) => (
    <LucideIconCmp ref={ref} size={size} strokeWidth={strokeWidth} {...rest} />
  ),
);

Icon.displayName = 'Icon';
