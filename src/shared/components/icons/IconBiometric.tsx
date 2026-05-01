/** IconBiometric — composite face + fingerprint (per §5). */
import type { CustomIconProps } from './types';

export function IconBiometric({
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
      <g fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {/* Face outline */}
        <path d="M12 4a5 5 0 0 0-5 5v2a5 5 0 1 0 10 0V9a5 5 0 0 0-5-5z" />
        <path d="M9 11c.5.5 1.5 1 3 1s2.5-.5 3-1" />
        <circle cx="9.5" cy="9" r="0.5" fill={color} stroke="none" />
        <circle cx="14.5" cy="9" r="0.5" fill={color} stroke="none" />
        {/* Fingerprint arcs */}
        <path d="M5 18c2-2 4-3 7-3s5 1 7 3" />
        <path d="M5 21c2-2 4-3 7-3s5 1 7 3" opacity={0.55} />
      </g>
    </svg>
  );
}
