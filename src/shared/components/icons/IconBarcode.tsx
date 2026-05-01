/** IconBarcode — replaces lucide barcode at scale (per §5). */
import type { CustomIconProps } from './types';

export function IconBarcode({
  width = 20,
  height = 20,
  color = 'currentColor',
  strokeWidth = 1.75,
  className,
  ariaLabel,
}: CustomIconProps): JSX.Element {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={className}
    >
      <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
        <line x1="4"  y1="5" x2="4"  y2="19" />
        <line x1="6"  y1="5" x2="6"  y2="19" strokeWidth={strokeWidth * 1.5} />
        <line x1="9"  y1="5" x2="9"  y2="19" />
        <line x1="11" y1="5" x2="11" y2="19" strokeWidth={strokeWidth * 0.6} />
        <line x1="14" y1="5" x2="14" y2="19" strokeWidth={strokeWidth * 1.4} />
        <line x1="17" y1="5" x2="17" y2="19" />
        <line x1="20" y1="5" x2="20" y2="19" strokeWidth={strokeWidth * 1.2} />
      </g>
    </svg>
  );
}
