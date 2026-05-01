/**
 * Pattern — heritage motif backgrounds at 4% opacity.
 * Source: Tasks/DESIGN_SYSTEM.md §3.1.
 *
 * Used as a watermark on:
 *  - Login splash background
 *  - Hub hero panel
 *  - EmptyState illustrations for primary feature areas
 *  - PrintLayout report headers
 *
 * Variants:
 *  - tessellation-8 — 8-fold star tessellation tile (default)
 *  - khayameya-stripes — multi-color heritage stripe (delegates to <KhayameyaStripe />)
 *  - corner-flourish — Islamic geometric corner motif (delegates to <CornerFlourish />)
 *
 * Usage:
 *   <Pattern variant="tessellation-8" className="absolute inset-0" />
 */

import { useId } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';

export type PatternVariant = 'tessellation-8' | 'khayameya-stripes' | 'corner-flourish';

interface PatternProps {
  variant?: PatternVariant;
  /** Tile size in px. Default 64. */
  tile?: number;
  /** Stroke colour, defaults to gold-500. */
  color?: string;
  /** Opacity 0..1, defaults to 0.04 per spec. */
  opacity?: number;
  className?: string;
  style?: CSSProperties;
}

export function Pattern({
  variant = 'tessellation-8',
  tile = 64,
  color = 'var(--gold-500)',
  opacity = 0.04,
  className,
  style,
}: PatternProps): JSX.Element {
  const patternId = useId();

  if (variant === 'tessellation-8') {
    /* 8-fold star — single 0.5px stroke per spec. Pattern repeats over the
       container via SVG <pattern>. The geometry traces a small square plus
       four triangles forming the canonical Islamic tessellation. */
    return (
      <svg
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
        style={{ opacity, ...style }}
        role="presentation"
      >
        <defs>
          <pattern id={patternId} width={tile} height={tile} patternUnits="userSpaceOnUse">
            <g fill="none" stroke={color} strokeWidth={0.5}>
              {/* Outer square */}
              <rect x={tile * 0.1} y={tile * 0.1} width={tile * 0.8} height={tile * 0.8} />
              {/* Rotated square (45°) */}
              <rect
                x={tile * 0.1}
                y={tile * 0.1}
                width={tile * 0.8}
                height={tile * 0.8}
                transform={`rotate(45 ${tile / 2} ${tile / 2})`}
              />
              {/* Inner star points */}
              <path
                d={`M ${tile / 2} ${tile * 0.2}
                    L ${tile * 0.65} ${tile * 0.5}
                    L ${tile / 2} ${tile * 0.8}
                    L ${tile * 0.35} ${tile * 0.5} Z`}
              />
              <path
                d={`M ${tile * 0.2} ${tile / 2}
                    L ${tile * 0.5} ${tile * 0.35}
                    L ${tile * 0.8} ${tile / 2}
                    L ${tile * 0.5} ${tile * 0.65} Z`}
              />
              {/* Connecting diagonals */}
              <line x1={0} y1={tile / 2} x2={tile} y2={tile / 2} />
              <line x1={tile / 2} y1={0} x2={tile / 2} y2={tile} />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    );
  }

  if (variant === 'khayameya-stripes') {
    /* Re-export rendered as a top stripe; consumers usually want the
       dedicated <KhayameyaStripe /> component but we include the variant
       here for symmetry with the spec naming. */
    return (
      <div
        aria-hidden
        className={cn('pointer-events-none absolute inset-x-0 top-0 h-1', className)}
        style={{
          background:
            'linear-gradient(to inline-end, ' +
            'var(--teal-500) 0%, var(--teal-500) 30%, ' +
            'var(--gold-500) 30%, var(--gold-500) 50%, ' +
            'var(--terra-500) 50%, var(--terra-500) 56%, ' +
            'var(--ink-700) 56%, var(--ink-700) 100%)',
          opacity,
          ...style,
        }}
      />
    );
  }

  /* corner-flourish variant — render four small SVG ornaments at corners */
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{ opacity, ...style }}
    >
      <CornerOrnament corner="tl" color={color} />
      <CornerOrnament corner="tr" color={color} />
      <CornerOrnament corner="bl" color={color} />
      <CornerOrnament corner="br" color={color} />
    </div>
  );
}

function CornerOrnament({
  corner,
  color,
  size = 16,
}: {
  corner: 'tl' | 'tr' | 'bl' | 'br';
  color: string;
  size?: number;
}): JSX.Element {
  const positions: Record<typeof corner, CSSProperties> = {
    tl: { top: 0, insetInlineStart: 0 },
    tr: { top: 0, insetInlineEnd: 0 },
    bl: { bottom: 0, insetInlineStart: 0 },
    br: { bottom: 0, insetInlineEnd: 0 },
  };
  const rotation = { tl: 0, tr: 90, br: 180, bl: 270 }[corner];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      style={{ position: 'absolute', transform: `rotate(${rotation}deg)`, ...positions[corner] }}
    >
      <g fill="none" stroke={color} strokeWidth="0.75">
        <path d="M0 0 L8 0 L8 1 L1 1 L1 8 L0 8 Z" />
        <path d="M3 3 L6 3 L6 4 L4 4 L4 6 L3 6 Z" />
      </g>
    </svg>
  );
}
