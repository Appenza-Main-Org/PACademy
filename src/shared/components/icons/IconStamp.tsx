/** IconStamp — "سرّي للغاية" stamp (per §5). */
import type { CustomIconProps } from './types';

export function IconStamp({
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
        <path d="M9 4h6l-1 5h2a3 3 0 0 1 3 3v2H5v-2a3 3 0 0 1 3-3h2L9 4z" />
        <path d="M4 19h16" />
        <path d="M4 19v2h16v-2" />
      </g>
    </svg>
  );
}
