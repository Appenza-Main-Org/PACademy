/**
 * Inline-SVG donut chart with center text + legend. Port of legacy charts.js.
 */

import { num } from '@/shared/lib/format';

interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: readonly DonutSlice[];
  size?: number;
  centerLabel?: string;
}

const PALETTE = ['#1B3A6B', '#C9A961', '#1A8754', '#B8770A', '#2D5BA0', '#7C2D8E', '#0E8E8E', '#C9501E', '#4A5568'];

export function DonutChart({ data, size = 220, centerLabel }: DonutChartProps): JSX.Element {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <div className="empty">لا توجد بيانات للعرض</div>;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const inner = r * 0.62;
  let cumulative = 0;
  const slices = data.map((d, i) => {
    const fraction = d.value / total;
    const startAngle = cumulative * Math.PI * 2;
    cumulative += fraction;
    const endAngle = cumulative * Math.PI * 2;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1 = cx + Math.sin(startAngle) * r;
    const y1 = cy - Math.cos(startAngle) * r;
    const x2 = cx + Math.sin(endAngle) * r;
    const y2 = cy - Math.cos(endAngle) * r;
    const x3 = cx + Math.sin(endAngle) * inner;
    const y3 = cy - Math.cos(endAngle) * inner;
    const x4 = cx + Math.sin(startAngle) * inner;
    const y4 = cy - Math.cos(startAngle) * inner;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    return { path, color: d.color ?? PALETTE[i % PALETTE.length], label: d.label, value: d.value };
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="donut chart" style={{ width: size, height: size, flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color}>
            <animate attributeName="opacity" from={0} to={1} dur="0.5s" fill="freeze" />
          </path>
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={20} fontFamily="Inter" fontWeight={700} fill="#0F1A2E">
          {num(total)}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={11} fill="#8B95A5">
          {centerLabel ?? 'الإجمالي'}
        </text>
      </svg>
      <ul className="flex flex-col gap-2 flex-1" style={{ minWidth: 160 }}>
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span className="flex-1 text-secondary">{s.label}</span>
            <span className="font-semibold">{num(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
