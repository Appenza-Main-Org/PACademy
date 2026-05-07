/**
 * DonutChart — inline-SVG donut with center total + legend.
 * Source: Tasks/DESIGN_SYSTEM.md §4.13.
 *
 * Re-skinned for Arabic Heritage Modern: heritage palette (teal/gold/terra/ink),
 * tabular figures for the center total, animation respects reduced motion.
 */

import { num } from '@/shared/lib/format';
import { prefersReducedMotion } from '@/shared/lib/motion';

interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: readonly DonutSlice[];
  size?: number;
  centerLabel?: string;
  ariaLabel?: string;
}

const PALETTE = [
  'var(--teal-500)',
  'var(--gold-500)',
  'var(--terra-500)',
  'var(--ink-700)',
  'var(--teal-300)',
  'var(--gold-300)',
  'var(--terra-300)',
  'var(--ink-400)',
  'var(--teal-700)',
];

export function DonutChart({
  data,
  size = 220,
  centerLabel,
  ariaLabel = 'مخطط دائري',
}: DonutChartProps): JSX.Element {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return <p className="px-4 py-9 text-center text-sm text-ink-500">لا توجد بيانات للعرض</p>;
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const inner = r * 0.62;
  let cumulative = 0;
  const animate = !prefersReducedMotion();
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
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        style={{ width: size, height: size, flexShrink: 0 }}
      >
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color}>
            {animate && (
              <animate
                attributeName="opacity"
                from={0}
                to={1}
                dur="0.4s"
                begin={`${i * 0.05}s`}
                fill="freeze"
              />
            )}
          </path>
        ))}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize={20}
          fontFamily="Inter"
          fontWeight={700}
          style={{ fontFeatureSettings: '"tnum"' }}
          fill="var(--ink-900)"
        >
          {num(total)}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={11} fill="var(--ink-500)">
          {centerLabel ?? 'الإجمالي'}
        </text>
      </svg>
      <ul className="flex flex-1 flex-col gap-2" style={{ minWidth: 160 }}>
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }}
            />
            <span className="flex-1 text-ink-500">{s.label}</span>
            <span className="font-medium font-numeric tnum">{num(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
