/** Shared props for the custom Egyptian-context icons (Tasks/DESIGN_SYSTEM.md §5). */
export interface CustomIconProps {
  width?: number;
  height?: number;
  color?: string;
  /** stroke-width override; default 1.75 per §5. */
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
}
