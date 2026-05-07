/** IconSeal — Egyptian eagle seal, outline only (per §5). */
import type { CustomIconProps } from './types';

export function IconSeal({
  width = 20,
  height = 20,
  color = 'currentColor',
  strokeWidth = 1.5,
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
      <g fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        {/* Stylised wings/eagle silhouette */}
        <path d="M5 13c2-2 4-3 7-3s5 1 7 3" />
        <path d="M9 9l3 3 3-3" />
        <path d="M12 6v6" />
        {/* Banner */}
        <path d="M8 17l-1 3 5-1.5 5 1.5-1-3" />
      </g>
    </svg>
  );
}
