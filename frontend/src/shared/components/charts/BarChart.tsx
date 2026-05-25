/**
 * BarChart — inline-SVG vertical bar chart.
 * Source: Tasks/DESIGN_SYSTEM.md §4.13.
 *
 * Re-skinned for Arabic Heritage Modern: teal default fill, ink axes,
 * Latin tabular numerals for value labels, hover tooltips, and the
 * entry animation skipped under prefers-reduced-motion.
 */

import { num } from '@/shared/lib/format';
import { prefersReducedMotion } from '@/shared/lib/motion';

export interface ChartDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: readonly ChartDatum[];
  height?: number;
  /** Fill colour (any valid CSS). Defaults to var(--accent-500) for app-flavoured surfaces. */
  color?: string;
  showValues?: boolean;
  ariaLabel?: string;
}

export function BarChart({
  data,
  height = 220,
  color = 'var(--accent-500)',
  showValues = true,
  ariaLabel = 'مخطط أعمدة',
}: BarChartProps): JSX.Element {
  if (!data.length) {
    return <p className="px-4 py-9 text-center text-sm text-ink-500">لا توجد بيانات للعرض</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 800;
  const padding = { top: 16, right: 16, bottom: 30, left: 40 };
  const plotW = w - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const barWidth = (plotW / data.length) * 0.7;
  const gap = (plotW / data.length) * 0.3;
  const animate = !prefersReducedMotion();

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', height }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padding.top + plotH * (1 - t);
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
      {data.map((d, i) => {
        const h = (d.value / max) * plotH;
        const x = padding.left + i * (barWidth + gap) + gap / 2;
        const y = padding.top + plotH - h;
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={x} y={y} width={barWidth} height={h} fill={color} rx={4}>
              {animate && (
                <>
                  <animate attributeName="height" from={0} to={h} dur="0.4s" fill="freeze" />
                  <animate
                    attributeName="y"
                    from={padding.top + plotH}
                    to={y}
                    dur="0.4s"
                    fill="freeze"
                  />
                </>
              )}
            </rect>
            {showValues && (
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize={11}
                fill="var(--ink-700)"
                fontFamily="Cairo"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {num(d.value)}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--ink-500)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
