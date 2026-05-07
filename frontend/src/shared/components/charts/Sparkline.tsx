/**
 * Sparkline — 80×24px micro line chart for stat cards.
 * Source: Tasks/DESIGN_SYSTEM.md §4.13.
 *
 * No axes, no labels, optional area fill, single colour.
 *
 * Usage:
 *   <Sparkline data={[12, 14, 13, 18, 16, 22, 28]} />
 */

import { useId } from 'react';

interface SparklineProps {
  data: readonly number[];
  width?: number;
  height?: number;
  color?: string;
  withArea?: boolean;
  ariaLabel?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = 'var(--accent-500)',
  withArea = true,
  ariaLabel = 'مخطط مصغّر',
}: SparklineProps): JSX.Element | null {
  const gradId = useId();
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * height,
  }));
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const area = withArea
    ? `${path} L ${width} ${height} L 0 ${height} Z`
    : '';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {withArea && area && <path d={area} fill={`url(#${gradId})`} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
