/**
 * Icon — wrapper around lucide-react icons with sensible defaults.
 * Always renders 18px stroke-width 2 to match the demo's visual weight.
 */

import type { LucideIcon, LucideProps } from 'lucide-react';
import { forwardRef } from 'react';

interface IconProps extends LucideProps {
  icon: LucideIcon;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ icon: LucideIconCmp, size = 18, strokeWidth = 2, ...rest }, ref) => (
    <LucideIconCmp ref={ref} size={size} strokeWidth={strokeWidth} {...rest} />
  ),
);

Icon.displayName = 'Icon';
