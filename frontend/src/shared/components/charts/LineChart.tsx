/**
 * LineChart — inline-SVG line chart with optional gradient area fill.
 * Source: Tasks/DESIGN_SYSTEM.md §4.13.
 *
 * Re-skinned for Arabic Heritage Modern: teal default stroke, ink grid,
 * subtle area gradient, animation suppressed under prefers-reduced-motion.
 */

import { useId } from 'react';
import type { ChartDatum } from './BarChart';
import { prefersReducedMotion } from '@/shared/lib/motion';

interface LineChartProps {
  data: readonly ChartDatum[];
  height?: number;
  /** Stroke colour. Defaults to var(--accent-500). */
  color?: string;
  withArea?: boolean;
  ariaLabel?: string;
}

export function LineChart({
  data,
  height = 220,
  color = 'var(--accent-500)',
  withArea = true,
  ariaLabel = 'مخطط خطّي',
}: LineChartProps): JSX.Element {
  const gradId = useId();
  if (data.length < 2) {
    return <p className="px-4 py-9 text-center text-sm text-ink-500">بيانات غير كافية</p>;
  }
  const w = 800;
  const padding = { top: 16, right: 16, bottom: 30, left: 40 };
  const plotW = w - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const animate = !prefersReducedMotion();

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * plotW;
    const y = padding.top + plotH - ((d.value - min) / range) * plotH;
    return { x, y, value: d.value, label: d.label };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    withArea && points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padding.top + plotH} L ${points[0].x} ${padding.top + plotH} Z`
      : '';

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', height }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padding.top + plotH * t;
        return (
          <line
            key={t}
            x1={padding.left}
            x2={w - padding.right}
            y1={y}
            y2={y}
            stroke="var(--ink-100)"
            strokeDasharray="3 4"
          />
        );
      })}
      {withArea && areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        data-chart-line="true"
      >
        {animate && (
          <animate attributeName="stroke-dasharray" from="0,2000" to="2000,0" dur="0.6s" fill="freeze" />
        )}
      </path>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="white" stroke={color} strokeWidth={1.75} />
          {i % Math.max(1, Math.floor(points.length / 8)) === 0 && (
            <text
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--ink-500)"
            >
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
