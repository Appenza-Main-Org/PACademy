/**
 * RuleRangeIndicator — visual bar showing every authored rule's range
 * for one applicant-category, with overlaps + gaps highlighted.
 *
 * Two stacked rails are drawn when both excellence modes are in play:
 *
 *   • شريط النسب المئوية (GRADES) — 0 → 100 axis. Each GRADES rule
 *     renders as a teal segment; overlapping intervals overlay in
 *     terra-500; uncovered intervals (gaps) render as a dashed gold
 *     hatch on the gap-track below the rail.
 *
 *   • شريط التقدير (TAGDIR) — rank axis (best → worst). Each TAGDIR
 *     rule renders as a gold segment across its grade band; overlaps +
 *     gaps are surfaced the same way.
 *
 * The bar exists for admin orientation, not as a primary control —
 * tooltips on every segment carry the rule index so the admin can find
 * the underlying row in the grid below.
 */

import { useMemo } from 'react';
import { Tooltip, TooltipProvider } from '@/shared/components';
import {
  readPercentageRange,
  useLookup,
  type AcademicGradeRow,
} from '@/features/lookups';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { cn } from '@/shared/lib/cn';
import { applicationSettingsQueryOptions } from '../../api/applicationSettings.queries';
import type {
  LocalGeneralRuleRow,
  LocalThanawiRow,
  LocalUniversityRow,
  MaxScoreOperator,
  MinScoreOperator,
} from '../../store/wizardSharedState';

interface RuleRangeIndicatorProps {
  /** Local ⊕ approved rows for one category, already filtered to that
   *  category. Pass everything; the component splits by excellenceMode. */
  rows: readonly LocalGeneralRuleRow[];
  /** Row ids that participate in a detected overlap pair. Drives the
   *  per-segment terra highlight. */
  overlappingIds: ReadonlySet<string>;
}

interface Segment {
  rowId: string;
  index: number;
  /** Percentage [0–100] on the rendered axis. */
  startPct: number;
  endPct: number;
  isOverlapping: boolean;
  label: string;
  hint: string;
}

const OPERATOR_SYMBOL: Record<MinScoreOperator | MaxScoreOperator, string> = {
  GREATER_THAN_OR_EQUAL: '≥',
  GREATER_THAN: '>',
  LESS_THAN_OR_EQUAL: '≤',
  LESS_THAN: '<',
};

const SCORE_AXIS_TICKS = [0, 25, 50, 75, 100] as const;

export function RuleRangeIndicator({
  rows,
  overlappingIds,
}: RuleRangeIndicatorProps): JSX.Element | null {
  const gradesQuery = useLookup('academic-grades', applicationSettingsQueryOptions);
  const gradeRows = useMemo<readonly AcademicGradeRow[]>(
    () => gradesQuery.data ?? [],
    [gradesQuery.data],
  );

  const gradeRank = useMemo(() => {
    const map = new Map<string, number>();
    gradeRows.forEach((row, index) => map.set(row.code, index));
    return map;
  }, [gradeRows]);

  const sortedRows = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) => {
          const at = a.createdAt ? Date.parse(a.createdAt) : 0;
          const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
          return at - bt;
        }),
    [rows],
  );

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    sortedRows.forEach((row, index) => map.set(row.id, index + 1));
    return map;
  }, [sortedRows]);

  const gradeSegments = useMemo<Segment[]>(
    () =>
      sortedRows
        .filter(
          (r): r is LocalGeneralRuleRow =>
            r.excellenceMode === 'GRADES' &&
            r.scoreMin !== null &&
            r.scoreMax !== null,
        )
        .map((r) => buildScoreSegment(r, indexById.get(r.id) ?? 0, overlappingIds))
        .filter((seg): seg is Segment => seg !== null),
    [sortedRows, indexById, overlappingIds],
  );

  const tagdirSegments = useMemo<Segment[]>(
    () =>
      sortedRows
        .filter(
          (r): r is LocalGeneralRuleRow =>
            r.excellenceMode === 'TAGDIR' &&
            r.grade.length > 0 &&
            r.gradeMax.length > 0,
        )
        .map((r) =>
          buildTagdirSegment(
            r,
            indexById.get(r.id) ?? 0,
            gradeRank,
            gradeRows,
            overlappingIds,
          ),
        )
        .filter((seg): seg is Segment => seg !== null),
    [sortedRows, indexById, gradeRank, gradeRows, overlappingIds],
  );

  if (gradeSegments.length === 0 && tagdirSegments.length === 0) return null;

  const gradeGaps = computeGaps(gradeSegments);
  const tagdirGaps = computeGaps(tagdirSegments);

  return (
    <TooltipProvider delayDuration={120}>
      <section
        className="mb-4 rounded-md border border-border-subtle bg-surface-card p-3"
        aria-label="نطاقات شروط الفئة"
      >
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="m-0 font-ar text-sm font-semibold text-ink-900">
              مؤشر نطاقات الشروط
            </h4>
            <p className="m-0 mt-0.5 font-ar text-2xs text-ink-500">
              يعرض النطاقات الحالية للشروط في هذه الفئة ويبرز التداخل أو الفجوات.
            </p>
          </div>
          <Legend />
        </header>

        {gradeSegments.length > 0 && (
          <RangeTrack
            title="النسبة المئوية (٪)"
            axisLabels={SCORE_AXIS_TICKS.map((n) => ({
              position: n,
              label: `${toEasternArabicNumerals(n)}٪`,
            }))}
            segments={gradeSegments}
            gaps={gradeGaps}
            tone="teal"
          />
        )}

        {tagdirSegments.length > 0 && (
          <div className={gradeSegments.length > 0 ? 'mt-3' : undefined}>
            <RangeTrack
              title="التقدير"
              axisLabels={gradeRows
                .filter((g) => g.isActive)
                .map((g, idx, arr) => {
                  /* Distribute lookup rows evenly across the rail so labels
                   * line up with the segment cells they represent. */
                  const position =
                    arr.length === 1 ? 50 : (idx / (arr.length - 1)) * 100;
                  return { position, label: g.name };
                })}
              segments={tagdirSegments}
              gaps={tagdirGaps}
              tone="gold"
            />
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}

/* ── Track + legend ──────────────────────────────────────────────── */

interface AxisLabel {
  position: number;
  label: string;
}

interface RangeTrackProps {
  title: string;
  axisLabels: readonly AxisLabel[];
  segments: readonly Segment[];
  gaps: readonly { startPct: number; endPct: number }[];
  tone: 'teal' | 'gold';
}

function RangeTrack({
  title,
  axisLabels,
  segments,
  gaps,
  tone,
}: RangeTrackProps): JSX.Element {
  const baseColor = tone === 'teal' ? 'var(--teal-500)' : 'var(--gold-500)';
  const baseBg = tone === 'teal' ? 'var(--teal-50)' : 'var(--gold-50)';

  /* Stack overlapping rules onto separate lanes so the admin can see
   * every range distinctly. Greedy interval-packing — newer rules drop
   * to a new lane only when they collide with every existing lane. */
  const lanes = useMemo(() => packIntoLanes(segments), [segments]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-ar text-2xs font-semibold text-ink-700">
          {title}
        </span>
        <span className="font-ar text-2xs text-ink-500">
          {toEasternArabicNumerals(segments.length)} شرط
        </span>
      </div>

      {/* Gap rail — light hatched fill marks uncovered intervals. */}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--ink-100)' }}
        aria-hidden
      >
        {gaps.map((gap, idx) => (
          <div
            key={`gap-${idx}`}
            className="absolute inset-y-0"
            style={{
              insetInlineStart: `${gap.startPct}%`,
              width: `${Math.max(0.5, gap.endPct - gap.startPct)}%`,
              background:
                'repeating-linear-gradient(45deg, var(--gold-200) 0 4px, transparent 4px 8px)',
            }}
          />
        ))}
      </div>

      {/* Rule lanes — one row per packing lane, stacked top-to-bottom. */}
      <div className="mt-2 flex flex-col gap-1.5">
        {lanes.map((lane, laneIdx) => (
          <div
            key={`lane-${laneIdx}`}
            className="relative h-6 w-full rounded-md"
            style={{ background: baseBg }}
          >
            {lane.map((segment) => (
              <Tooltip key={segment.rowId} content={segment.hint}>
                <button
                  type="button"
                  aria-label={segment.hint}
                  className={cn(
                    'absolute inset-y-0 flex items-center justify-center rounded-md border font-ar text-2xs font-semibold tabular-nums text-surface-card',
                    'transition-shadow duration-fast hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                    segment.isOverlapping && 'animate-none',
                  )}
                  style={{
                    insetInlineStart: `${segment.startPct}%`,
                    width: `${Math.max(2, segment.endPct - segment.startPct)}%`,
                    background: segment.isOverlapping
                      ? 'var(--terra-500)'
                      : baseColor,
                    borderColor: segment.isOverlapping
                      ? 'var(--terra-700)'
                      : 'transparent',
                  }}
                >
                  <span className="truncate px-1">{segment.label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        ))}
      </div>

      {/* Axis ticks — best-effort label placement. */}
      <div
        aria-hidden
        className="relative mt-1 h-4 w-full"
      >
        {axisLabels.map((tick, idx) => (
          <span
            key={`tick-${idx}`}
            className="absolute top-0 -translate-x-1/2 font-en text-2xs tabular-nums text-ink-500"
            style={{ insetInlineStart: `${tick.position}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Legend(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <LegendItem
        swatchStyle={{ background: 'var(--teal-500)' }}
        label="نطاق درجة"
      />
      <LegendItem
        swatchStyle={{ background: 'var(--gold-500)' }}
        label="نطاق تقدير"
      />
      <LegendItem
        swatchStyle={{ background: 'var(--terra-500)' }}
        label="تداخل"
      />
      <LegendItem
        swatchStyle={{
          background:
            'repeating-linear-gradient(45deg, var(--gold-200) 0 4px, var(--ink-100) 4px 8px)',
        }}
        label="فجوة"
      />
    </div>
  );
}

function LegendItem({
  swatchStyle,
  label,
}: {
  swatchStyle: React.CSSProperties;
  label: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 font-ar text-2xs text-ink-600">
      <span
        aria-hidden
        className="inline-block h-2.5 w-3.5 rounded-sm"
        style={swatchStyle}
      />
      {label}
    </span>
  );
}

/* ── Segment builders ─────────────────────────────────────────────── */

function buildScoreSegment(
  row: LocalGeneralRuleRow,
  index: number,
  overlappingIds: ReadonlySet<string>,
): Segment | null {
  if (row.scoreMin === null || row.scoreMax === null) return null;
  const lo = clamp(row.scoreMin, 0, 100);
  const hi = clamp(row.scoreMax, 0, 100);
  if (hi < lo) return null;
  return {
    rowId: row.id,
    index,
    startPct: lo,
    endPct: hi,
    isOverlapping: overlappingIds.has(row.id),
    label: `#${toEasternArabicNumerals(index)}`,
    hint: scopeLabel(row, index, row.minScoreOperator, row.maxScoreOperator),
  };
}

function buildTagdirSegment(
  row: LocalGeneralRuleRow,
  index: number,
  gradeRank: ReadonlyMap<string, number>,
  gradeRows: readonly AcademicGradeRow[],
  overlappingIds: ReadonlySet<string>,
): Segment | null {
  const minRank = gradeRank.get(row.grade);
  const maxRank = gradeRank.get(row.gradeMax);
  if (minRank === undefined || maxRank === undefined) return null;
  const activeCount = gradeRows.filter((g) => g.isActive).length;
  if (activeCount === 0) return null;
  const denom = activeCount === 1 ? 1 : activeCount - 1;
  const lo = (Math.min(minRank, maxRank) / denom) * 100;
  const hi = (Math.max(minRank, maxRank) / denom) * 100;
  /* Pad each end so a single-grade band still has clickable width. */
  const padding = 100 / Math.max(activeCount, 2) / 2;
  const minLabel = gradeRows[minRank]?.name ?? row.grade;
  const maxLabel = gradeRows[maxRank]?.name ?? row.gradeMax;
  return {
    rowId: row.id,
    index,
    startPct: clamp(Math.min(lo, hi) - padding, 0, 100),
    endPct: clamp(Math.max(lo, hi) + padding, 0, 100),
    isOverlapping: overlappingIds.has(row.id),
    label: `#${toEasternArabicNumerals(index)}`,
    hint: `#${toEasternArabicNumerals(index)} · ${maxLabel} → ${minLabel}${
      readPercentageRange(gradeRows[minRank] ?? gradeRows[0])
        ? ` · ${formatGradePercentageRange(gradeRows, minRank, maxRank)}`
        : ''
    }`,
  };
}

function scopeLabel(
  row: LocalGeneralRuleRow,
  index: number,
  minOp: MinScoreOperator,
  maxOp: MaxScoreOperator,
): string {
  const minSym = OPERATOR_SYMBOL[minOp];
  const maxSym = OPERATOR_SYMBOL[maxOp];
  const scope = row.kind === 'university'
    ? `${(row as LocalUniversityRow).specializationNameAr}`
    : `لجنة: ${(row as LocalThanawiRow).committee || '—'}`;
  return `#${toEasternArabicNumerals(index)} · ${scope} · ${minSym} ${toEasternArabicNumerals(
    row.scoreMin ?? 0,
  )}٪ — ${maxSym} ${toEasternArabicNumerals(row.scoreMax ?? 0)}٪`;
}

function formatGradePercentageRange(
  gradeRows: readonly AcademicGradeRow[],
  minRank: number,
  maxRank: number,
): string {
  const a = gradeRows[Math.min(minRank, maxRank)];
  const b = gradeRows[Math.max(minRank, maxRank)];
  const ra = a ? readPercentageRange(a) : null;
  const rb = b ? readPercentageRange(b) : null;
  if (!ra || !rb) return '';
  return `${toEasternArabicNumerals(rb.min)}–${toEasternArabicNumerals(ra.max)}٪`;
}

/* ── Lane packing + gap math ─────────────────────────────────────── */

function packIntoLanes(segments: readonly Segment[]): Segment[][] {
  const lanes: Segment[][] = [];
  for (const seg of segments) {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (!last || last.endPct < seg.startPct) {
        lane.push(seg);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([seg]);
  }
  return lanes;
}

function computeGaps(
  segments: readonly Segment[],
): { startPct: number; endPct: number }[] {
  if (segments.length === 0) return [{ startPct: 0, endPct: 100 }];
  const merged: { startPct: number; endPct: number }[] = [];
  const sorted = segments
    .slice()
    .sort((a, b) => a.startPct - b.startPct);
  let current = { startPct: sorted[0].startPct, endPct: sorted[0].endPct };
  for (const seg of sorted.slice(1)) {
    if (seg.startPct <= current.endPct) {
      current.endPct = Math.max(current.endPct, seg.endPct);
    } else {
      merged.push(current);
      current = { startPct: seg.startPct, endPct: seg.endPct };
    }
  }
  merged.push(current);

  const gaps: { startPct: number; endPct: number }[] = [];
  let cursor = 0;
  for (const block of merged) {
    if (block.startPct > cursor) {
      gaps.push({ startPct: cursor, endPct: block.startPct });
    }
    cursor = Math.max(cursor, block.endPct);
  }
  if (cursor < 100) gaps.push({ startPct: cursor, endPct: 100 });
  return gaps;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
