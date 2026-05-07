/** IconCertificate — Arabic-style certificate scroll (per §5). */
import type { CustomIconProps } from './types';

export function IconCertificate({
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
        <rect x="4" y="4" width="16" height="14" rx="2" />
        <path d="M8 9h8 M8 12h6 M8 15h5" />
        <circle cx="17" cy="18" r="3" />
        <path d="M15.5 19.5l-1 3 2.5-1.5 2.5 1.5-1-3" />
      </g>
    </svg>
  );
}
