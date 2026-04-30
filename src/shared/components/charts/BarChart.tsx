/**
 * Inline-SVG bar chart — no third-party deps. Direct port of legacy charts.js.
 */

import { num } from '@/shared/lib/format';

export interface ChartDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: readonly ChartDatum[];
  height?: number;
  color?: string;
  showValues?: boolean;
}

export function BarChart({ data, height = 220, color = '#2D5BA0', showValues = true }: BarChartProps): JSX.Element {
  if (!data.length) return <div className="empty">لا توجد بيانات للعرض</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 800;
  const padding = { top: 16, right: 16, bottom: 30, left: 40 };
  const plotW = w - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const barWidth = (plotW / data.length) * 0.7;
  const gap = (plotW / data.length) * 0.3;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} role="img" aria-label="bar chart" style={{ width: '100%', height }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padding.top + plotH * (1 - t);
        return (
          <line key={t} x1={padding.left} x2={w - padding.right} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 4" />
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * plotH;
        const x = padding.left + i * (barWidth + gap) + gap / 2;
        const y = padding.top + plotH - h;
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={x} y={y} width={barWidth} height={h} fill={color} rx={4} opacity={0.9}>
              <animate attributeName="height" from={0} to={h} dur="0.6s" fill="freeze" />
              <animate attributeName="y" from={padding.top + plotH} to={y} dur="0.6s" fill="freeze" />
            </rect>
            {showValues && (
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="#4A5568" fontFamily="Inter">
                {num(d.value)}
              </text>
            )}
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="#8B95A5">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
