/**
 * HeatmapChart — labelled rows × cols heatmap with semantic colour scales.
 * Source: Tasks/DESIGN_SYSTEM.md §4.13 + reports command-center brief.
 *
 * Distinct from the existing `Heatmap` (single teal scale, day×hour shape):
 * this primitive is **rectangular** with explicit row + col labels and
 * supports a 3-stop diverging "pass-rate" scale (terra → gold → success)
 * for "% passed" cells. RTL-aware: labels render at the start edge.
 *
 * Inline SVG only — no third-party charting libraries.
 *
 * Usage:
 *   <HeatmapChart
 *     rows={['القاهرة', 'الجيزة', …]}
 *     cols={['طبي', 'بدني', 'نفسي', 'مقابلة', 'مخدرات']}
 *     data={[[78,82,71,74,98], …]}
 *     colorScale="pass-rate"
 *     formatCell={(v) => `${v}%`}
 *   />
 */

import { useMemo } from 'react';
import { prefersReducedMotion } from '@/shared/lib/motion';

export type HeatmapColorScale = 'pass-rate' | 'volume';

interface HeatmapChartProps {
  rows: readonly string[];
  cols: readonly string[];
  /** rows × cols matrix. */
  data: readonly (readonly number[])[];
  colorScale?: HeatmapColorScale;
  /** Optional cell formatter (e.g. (v) => `${v}%`). Default: integer. */
  formatCell?: (value: number) => string;
  /** Cell width in CSS px. Cells are square by default. */
  cellSize?: number;
  ariaLabel?: string;
}

/** 3-stop diverging scale for pass-rate cells: terra (0%) → gold (50%) → success (100%). */
const PASS_RATE_STOPS: { stop: number; color: string }[] = [
  { stop: 0, color: 'var(--terra-500)' },
  { stop: 25, color: 'var(--terra-300)' },
  { stop: 50, color: 'var(--gold-400)' },
  { stop: 75, color: 'var(--teal-300)' },
  { stop: 100, color: 'var(--success)' },
];

/** 5-stop monotonic scale for volume cells. */
const VOLUME_STOPS: string[] = [
  'var(--ink-100)',
  'var(--teal-100)',
  'var(--teal-300)',
  'var(--teal-500)',
  'var(--teal-700)',
];

function colorFor(value: number, scale: HeatmapColorScale, max: number): string {
  if (scale === 'pass-rate') {
    /* Find the bracket whose stop <= value < next.stop. */
    const v = Math.min(100, Math.max(0, value));
    for (let i = PASS_RATE_STOPS.length - 1; i >= 0; i -= 1) {
      if (v >= (PASS_RATE_STOPS[i]!.stop)) return PASS_RATE_STOPS[i]!.color;
    }
    return PASS_RATE_STOPS[0]!.color;
  }
  /* volume scale */
  if (max === 0) return VOLUME_STOPS[0]!;
  const ratio = Math.min(1, Math.max(0, value / max));
  const idx = Math.min(VOLUME_STOPS.length - 1, Math.floor(ratio * VOLUME_STOPS.length));
  return VOLUME_STOPS[idx]!;
}

export function HeatmapChart({
  rows,
  cols,
  data,
  colorScale = 'pass-rate',
  formatCell,
  cellSize = 56,
  ariaLabel = 'مصفوفة كثافة',
}: HeatmapChartProps): JSX.Element {
  const animate = !prefersReducedMotion();
  const max = useMemo(
    () => Math.max(0, ...data.flatMap((row) => row.slice())),
    [data],
  );

  if (rows.length === 0 || cols.length === 0) {
    return <p className="px-4 py-9 text-center text-sm text-ink-500">لا توجد بيانات</p>;
  }

  const rowLabelWidth = 96;
  const colLabelHeight = 28;
  const gap = 4;
  const w = rowLabelWidth + cols.length * (cellSize + gap);
  const h = colLabelHeight + rows.length * (cellSize + gap);

  const fmt = formatCell ?? ((v: number) => String(Math.round(v)));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={ariaLabel}
        style={{ width: '100%', maxWidth: w, height: 'auto' }}
      >
        {/* Column labels (test kinds) */}
        {cols.map((label, c) => (
          <text
            key={`col-${c}`}
            x={rowLabelWidth + c * (cellSize + gap) + cellSize / 2}
            y={colLabelHeight - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight={500}
            fill="var(--ink-700)"
          >
            {label}
          </text>
        ))}

        {/* Row labels (governorates) — rendered at the start edge for RTL */}
        {rows.map((label, r) => (
          <text
            key={`row-${r}`}
            x={rowLabelWidth - 8}
            y={colLabelHeight + r * (cellSize + gap) + cellSize / 2 + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--ink-700)"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {data.map((row, r) =>
          row.map((value, c) => {
            const x = rowLabelWidth + c * (cellSize + gap);
            const y = colLabelHeight + r * (cellSize + gap);
            const fill = colorFor(value, colorScale, max);
            const textFill =
              colorScale === 'pass-rate'
                ? value >= 50
                  ? 'var(--ink-50)'
                  : 'var(--ink-900)'
                : value > max * 0.55
                  ? 'var(--ink-50)'
                  : 'var(--ink-900)';
            return (
              <g key={`cell-${r}-${c}`}>
                <rect x={x} y={y} width={cellSize} height={cellSize} rx={6} fill={fill}>
                  <title>{`${rows[r]} · ${cols[c]} · ${fmt(value)}`}</title>
                  {animate && (
                    <animate
                      attributeName="opacity"
                      from={0}
                      to={1}
                      dur="0.35s"
                      begin={`${(r + c) * 0.02}s`}
                      fill="freeze"
                    />
                  )}
                </rect>
                <text
                  x={x + cellSize / 2}
                  y={y + cellSize / 2 + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fontFamily="Inter"
                  style={{ fontFeatureSettings: '"tnum"' }}
                  fill={textFill}
                >
                  {fmt(value)}
                </text>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

interface HeatmapLegendProps {
  scale?: HeatmapColorScale;
  className?: string;
}

/** Small inline legend matching the cell colour scale. */
export function HeatmapLegend({ scale = 'pass-rate', className }: HeatmapLegendProps): JSX.Element {
  const stops =
    scale === 'pass-rate'
      ? [
          { label: '٠٪', color: 'var(--terra-500)' },
          { label: '٢٥٪', color: 'var(--terra-300)' },
          { label: '٥٠٪', color: 'var(--gold-400)' },
          { label: '٧٥٪', color: 'var(--teal-300)' },
          { label: '١٠٠٪', color: 'var(--success)' },
        ]
      : VOLUME_STOPS.map((color, i) => ({ label: i === 0 ? 'منخفض' : i === VOLUME_STOPS.length - 1 ? 'مرتفع' : '', color }));
  return (
    <ul className={className} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {stops.map((s, i) => (
        <li key={i} className="flex items-center gap-1 text-2xs text-ink-500">
          <span
            aria-hidden
            className="inline-block rounded-sm"
            style={{ width: 14, height: 14, background: s.color }}
          />
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}
