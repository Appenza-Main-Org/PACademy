/**
 * Inline-SVG line chart with gradient area fill. Direct port of legacy charts.js.
 */

import type { ChartDatum } from './BarChart';

interface LineChartProps {
  data: readonly ChartDatum[];
  height?: number;
  color?: string;
}

export function LineChart({ data, height = 220, color = '#2D5BA0' }: LineChartProps): JSX.Element {
  if (data.length < 2) return <div className="empty">بيانات غير كافية</div>;
  const w = 800;
  const padding = { top: 16, right: 16, bottom: 30, left: 40 };
  const plotW = w - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * plotW;
    const y = padding.top + plotH - ((d.value - min) / range) * plotH;
    return { x, y, value: d.value, label: d.label };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]!.x} ${padding.top + plotH} L ${points[0]!.x} ${padding.top + plotH} Z`;

  const gradId = `lc-grad-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} role="img" aria-label="line chart" style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padding.top + plotH * t;
        return <line key={t} x1={padding.left} x2={w - padding.right} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 4" />;
      })}
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
        <animate attributeName="stroke-dasharray" from="0,2000" to="2000,0" dur="0.9s" fill="freeze" />
      </path>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="white" stroke={color} strokeWidth={2} />
          {i % 2 === 0 && (
            <text x={p.x} y={height - 8} textAnchor="middle" fontSize={11} fill="#8B95A5">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
