/**
 * HeatmapChart — labelled rows × cols heatmap with semantic colour scales.
 * Source: Tasks/DESIGN_SYSTEM.md §4.13 + reports command-center brief.
 *
 * Distinct from the existing `Heatmap` (single teal scale, day×hour shape):
 * this primitive is **rectangular** with explicit row + col labels and
 * supports a 3-stop diverging "pass-rate" scale (terra → gold → success)
 * for "% passed" cells. RTL-friendly: implemented as a CSS grid so labels
 * flow naturally with the document direction and Arabic governorate
 * names render with full text instead of clipping inside a fixed SVG box.
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

export type HeatmapColorScale = 'pass-rate' | 'volume';

interface HeatmapChartProps {
  rows: readonly string[];
  cols: readonly string[];
  /** rows × cols matrix. */
  data: readonly (readonly number[])[];
  colorScale?: HeatmapColorScale;
  /** Optional cell formatter (e.g. (v) => `${v}%`). Default: integer. */
  formatCell?: (value: number) => string;
  /** Cell size in CSS px (cells are square). */
  cellSize?: number;
  ariaLabel?: string;
}

/** 5-stop diverging scale for pass-rate cells. */
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
    const v = Math.min(100, Math.max(0, value));
    for (let i = PASS_RATE_STOPS.length - 1; i >= 0; i -= 1) {
      if (v >= PASS_RATE_STOPS[i].stop) return PASS_RATE_STOPS[i].color;
    }
    return PASS_RATE_STOPS[0].color;
  }
  if (max === 0) return VOLUME_STOPS[0];
  const ratio = Math.min(1, Math.max(0, value / max));
  const idx = Math.min(VOLUME_STOPS.length - 1, Math.floor(ratio * VOLUME_STOPS.length));
  return VOLUME_STOPS[idx];
}

function textColorFor(value: number, scale: HeatmapColorScale, max: number): string {
  if (scale === 'pass-rate') {
    return value >= 50 ? 'var(--ink-50)' : 'var(--ink-900)';
  }
  return value > max * 0.55 ? 'var(--ink-50)' : 'var(--ink-900)';
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
  const fmt = formatCell ?? ((v: number) => String(Math.round(v)));

  if (rows.length === 0 || cols.length === 0) {
    return <p className="px-4 py-9 text-center text-sm text-ink-500">لا توجد بيانات</p>;
  }

  const max = Math.max(0, ...data.flatMap((row) => row.slice()));
  const labelColMin = 96;
  const gridTemplateColumns = `minmax(${labelColMin}px, max-content) repeat(${cols.length}, ${cellSize}px)`;

  return (
    <div className="overflow-x-auto" role="img" aria-label={ariaLabel}>
      <div className="inline-grid gap-1" style={{ gridTemplateColumns }}>
        {/* Header row: blank corner + col labels */}
        <span aria-hidden />
        {cols.map((label, c) => (
          <span
            key={`col-${c}`}
            className="pb-2 text-center text-xs font-medium text-ink-700"
            style={{ width: cellSize }}
          >
            {label}
          </span>
        ))}

        {/* Data rows */}
        {rows.map((rowLabel, r) => (
          <RowFragment
            key={`row-${r}`}
            label={rowLabel}
            cellSize={cellSize}
            cells={data[r] ?? []}
            cols={cols}
            colorScale={colorScale}
            max={max}
            fmt={fmt}
          />
        ))}
      </div>
    </div>
  );
}

interface RowFragmentProps {
  label: string;
  cellSize: number;
  cells: readonly number[];
  cols: readonly string[];
  colorScale: HeatmapColorScale;
  max: number;
  fmt: (v: number) => string;
}

function RowFragment({ label, cellSize, cells, cols, colorScale, max, fmt }: RowFragmentProps): JSX.Element {
  return (
    <>
      <span
        className="flex items-center justify-end pe-3 text-xs text-ink-700"
        style={{ height: cellSize }}
      >
        {label}
      </span>
      {cells.map((value, c) => (
        <span
          key={`cell-${c}`}
          title={`${label} · ${cols[c]} · ${fmt(value)}`}
          className="flex items-center justify-center rounded-md font-numeric tnum text-sm font-semibold"
          style={{
            width: cellSize,
            height: cellSize,
            background: colorFor(value, colorScale, max),
            color: textColorFor(value, colorScale, max),
          }}
        >
          {fmt(value)}
        </span>
      ))}
    </>
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
      : VOLUME_STOPS.map((color, i) => ({
          label: i === 0 ? 'منخفض' : i === VOLUME_STOPS.length - 1 ? 'مرتفع' : '',
          color,
        }));
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
