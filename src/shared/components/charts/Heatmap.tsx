/**
 * Heatmap — inline-SVG 7×N grid (days × weeks).
 * Source: Tasks/DESIGN_SYSTEM.md §4.13.
 *
 * Color stops from --ink-100 (cold) to --teal-700 (hot).
 * Used in Admin Dashboard ("applications by hour×day") and Reports.
 *
 * Usage:
 *   <Heatmap
 *     data={cells}                // matrix [day][slot] of numbers
 *     rowLabels={['السبت','الأحد',...]}
 *     colLabels={['8','10','12',...]}
 *   />
 */

import { useMemo } from 'react';
import { prefersReducedMotion } from '@/shared/lib/motion';

interface HeatmapProps {
  /** 2D array: rows × cols. */
  data: readonly (readonly number[])[];
  rowLabels?: readonly string[];
  colLabels?: readonly string[];
  cellSize?: number;
  /** Optional max override; defaults to max value in data. */
  max?: number;
  /** Optional aria-label. */
  ariaLabel?: string;
}

const STOPS = ['var(--ink-100)', 'var(--teal-100)', 'var(--teal-300)', 'var(--teal-500)', 'var(--teal-700)'];

export function Heatmap({
  data,
  rowLabels,
  colLabels,
  cellSize = 22,
  max,
  ariaLabel = 'خريطة كثافة',
}: HeatmapProps): JSX.Element {
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const computedMax = useMemo(
    () => max ?? Math.max(1, ...data.flatMap((row) => row.slice())),
    [data, max],
  );
  const animate = !prefersReducedMotion();

  if (rows === 0 || cols === 0) {
    return <p className="px-4 py-9 text-center text-sm text-ink-500">لا توجد بيانات</p>;
  }

  const labelWidth = rowLabels ? 56 : 0;
  const labelHeight = colLabels ? 18 : 0;
  const gap = 2;
  const w = labelWidth + cols * (cellSize + gap);
  const h = labelHeight + rows * (cellSize + gap);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', maxWidth: w, height: 'auto' }}
    >
      {colLabels?.map((label, c) => (
        <text
          key={`col-${c}`}
          x={labelWidth + c * (cellSize + gap) + cellSize / 2}
          y={labelHeight - 4}
          textAnchor="middle"
          fontSize={10}
          fill="var(--ink-500)"
        >
          {label}
        </text>
      ))}
      {data.map((row, r) =>
        row.map((value, c) => {
          const ratio = computedMax === 0 ? 0 : value / computedMax;
          const stopIdx = Math.min(STOPS.length - 1, Math.floor(ratio * STOPS.length));
          const fill = value === 0 ? 'var(--ink-50)' : STOPS[stopIdx];
          return (
            <g key={`${r}-${c}`}>
              <rect
                x={labelWidth + c * (cellSize + gap)}
                y={labelHeight + r * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={3}
                fill={fill}
              >
                <title>
                  {(rowLabels?.[r] ?? `Row ${r + 1}`)} · {(colLabels?.[c] ?? `Col ${c + 1}`)} · {value}
                </title>
                {animate && (
                  <animate
                    attributeName="opacity"
                    from={0}
                    to={1}
                    dur="0.3s"
                    begin={`${(r + c) * 0.015}s`}
                    fill="freeze"
                  />
                )}
              </rect>
            </g>
          );
        }),
      )}
      {rowLabels?.map((label, r) => (
        <text
          key={`row-${r}`}
          x={labelWidth - 6}
          y={labelHeight + r * (cellSize + gap) + cellSize / 2 + 3}
          textAnchor="end"
          fontSize={10}
          fill="var(--ink-500)"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
