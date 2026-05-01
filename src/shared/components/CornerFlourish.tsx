/**
 * CornerFlourish — small Islamic geometric corner ornament.
 * Source: Tasks/DESIGN_SYSTEM.md §3.3.
 *
 * Default 16×16px. Used in:
 *  - Modal corners (4 corners, gold-300, 30% alpha)
 *  - Certificate top corners (gold-500, 100%)
 *  - Print headers
 *
 * Usage:
 *   <CornerFlourish corner="tl" />
 *   <CornerFlourish corner="tr" size={20} color="var(--gold-500)" />
 */

import type { CSSProperties } from 'react';

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

interface CornerFlourishProps {
  corner: Corner;
  size?: number;
  color?: string;
  /** Opacity 0..1. Defaults to 0.3 (modal usage); use 1 for certificates. */
  opacity?: number;
  className?: string;
  style?: CSSProperties;
}

const POSITION: Record<Corner, CSSProperties> = {
  tl: { top: 0, insetInlineStart: 0 },
  tr: { top: 0, insetInlineEnd: 0 },
  bl: { bottom: 0, insetInlineStart: 0 },
  br: { bottom: 0, insetInlineEnd: 0 },
};

const ROTATION: Record<Corner, number> = { tl: 0, tr: 90, br: 180, bl: 270 };

export function CornerFlourish({
  corner,
  size = 16,
  color = 'var(--gold-300)',
  opacity = 0.3,
  className,
  style,
}: CornerFlourishProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      role="presentation"
      className={className}
      style={{
        position: 'absolute',
        opacity,
        transform: `rotate(${ROTATION[corner]}deg)`,
        transformOrigin: 'center',
        ...POSITION[corner],
        ...style,
      }}
    >
      <g fill="none" stroke={color} strokeWidth={0.9} strokeLinecap="round">
        {/* Outer L brace */}
        <path d="M1 1 L9 1 M1 1 L1 9" />
        {/* Inner step */}
        <path d="M3 3 L7 3 L7 4 L4 4 L4 7 L3 7 Z" />
        {/* Diagonal accent */}
        <path d="M5 5 L8 8" strokeWidth={0.6} />
      </g>
    </svg>
  );
}
