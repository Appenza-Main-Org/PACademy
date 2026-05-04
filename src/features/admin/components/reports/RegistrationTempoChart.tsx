/**
 * RegistrationTempoChart — overlaid this-cycle vs prev-cycle line chart.
 * Inline SVG, RTL-aware (dual-line over a 30-day window).
 */

interface RegistrationTempoChartProps {
  thisCycle: { label: string; value: number }[];
  prevCycle: { label: string; value: number }[];
}

export function RegistrationTempoChart({ thisCycle, prevCycle }: RegistrationTempoChartProps): JSX.Element {
  const w = 800;
  const h = 200;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;
  const max = Math.max(1, ...thisCycle.map((d) => d.value), ...prevCycle.map((d) => d.value));
  const len = thisCycle.length;
  if (len === 0) return <p className="px-4 py-9 text-center text-sm text-ink-500">لا توجد بيانات</p>;

  const path = (data: { value: number }[]): string =>
    data
      .map((d, i) => {
        const x = padding.left + (i / Math.max(1, len - 1)) * plotW;
        const y = padding.top + plotH - (d.value / max) * plotH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="إيقاع التقديم اليومي" style={{ width: '100%', height: h }}>
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
      <path
        d={path(prevCycle)}
        fill="none"
        stroke="var(--gold-400)"
        strokeWidth={2}
        strokeOpacity={0.7}
        strokeDasharray="5 4"
      />
      <path d={path(thisCycle)} fill="none" stroke="var(--teal-500)" strokeWidth={2.5} />
    </svg>
  );
}
