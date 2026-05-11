/**
 * ImportLookupPreview — parsed-rows table with conflict resolution controls.
 *
 * Shows:
 *   - Count chips: valid / conflicts / errors
 *   - DataTable with one row per parsed file row
 *   - ImportConflictRow controls for collision rows
 *   - Progress bar overlay during 'committing' phase
 *
 * Usage:
 *   <ImportLookupPreview
 *     session={session}
 *     progress={progress}
 *     onResolutionChange={handleResolution}
 *   />
 */

import { Badge, DataTable } from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import type { ImportSession, ParsedRow } from '../../api/lookup-import';
import { ImportConflictRow } from './ImportConflictRow';
import type { ActiveConflictResolution, ArchivedConflictResolution } from '../../api/lookup-import';

interface ImportLookupPreviewProps {
  session: ImportSession;
  /** Rows committed so far (used to render progress bar). */
  progressDone?: number;
  onResolutionChange: (rowIndex: number, resolution: ActiveConflictResolution | ArchivedConflictResolution) => void;
}

const MAX_DISPLAYED_ROWS = 500;

/** Parsed-rows preview with resolution controls. */
export function ImportLookupPreview({
  session,
  progressDone = 0,
  onResolutionChange,
}: ImportLookupPreviewProps): JSX.Element {
  const committing = session.phase === 'committing';
  const rows = session.rows.slice(0, MAX_DISPLAYED_ROWS);
  const truncated = session.rows.length > MAX_DISPLAYED_ROWS;

  const valid = session.rows.filter((r) => r.classification === 'valid').length;
  const conflicts = session.rows.filter(
    (r) => r.classification === 'active_collision' || r.classification === 'archived_collision',
  ).length;
  const errors = session.rows.filter((r) => r.classification === 'errored').length;
  const total = session.rows.length;

  const columns: DataTableColumn<ParsedRow>[] = [
    {
      key: 'index',
      label: '#',
      width: 52,
      render: (r) => (
        <span className="font-numeric tnum text-2xs text-ink-400">{r.index + 2}</span>
      ),
    },
    {
      key: 'classification',
      label: 'الحالة',
      width: 120,
      render: (r) => <ClassificationBadge row={r} />,
    },
    {
      key: 'arabicValues',
      label: 'البيانات',
      render: (r) => <RowValuesSummary row={r} />,
    },
    {
      key: 'resolution',
      label: 'الإجراء',
      width: 220,
      render: (r) =>
        r.classification === 'active_collision' || r.classification === 'archived_collision' ? (
          <ImportConflictRow
            row={r}
            onResolutionChange={onResolutionChange}
            disabled={committing}
          />
        ) : r.outcome ? (
          <OutcomeBadge outcome={r.outcome} />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Count chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs text-ink-500">
          إجمالي: <span className="font-numeric tnum font-medium text-ink-900">{total}</span>
        </span>
        {valid > 0 && (
          <Badge tone="success">{valid} صالح</Badge>
        )}
        {conflicts > 0 && (
          <Badge tone="warning">{conflicts} تعارض</Badge>
        )}
        {errors > 0 && (
          <Badge tone="danger">{errors} خطأ</Badge>
        )}
        {truncated && (
          <Badge tone="neutral">يُعرض أول {MAX_DISPLAYED_ROWS} فقط</Badge>
        )}
      </div>

      {/* Progress bar during committing */}
      {committing && total > 0 && (
        <div className="overflow-hidden rounded-full bg-ink-100" aria-label="تقدم الاستيراد">
          <div
            className="h-1.5 rounded-full bg-teal-500 transition-all duration-300"
            style={{ width: `${Math.round((progressDone / total) * 100)}%` }}
            role="progressbar"
            aria-valuenow={progressDone}
            aria-valuemin={0}
            aria-valuemax={total}
          />
        </div>
      )}

      <DataTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.index}
        zebraStripes
        stickyHeader
        density="compact"
      />
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function ClassificationBadge({ row }: { row: ParsedRow }): JSX.Element {
  if (row.outcome === 'created') return <Badge tone="success">تم الإنشاء</Badge>;
  if (row.outcome === 'updated') return <Badge tone="success">تم التحديث</Badge>;
  if (row.outcome === 'restored') return <Badge tone="success">تمت الاستعادة</Badge>;
  if (row.outcome === 'skipped') return <Badge tone="neutral">تم التخطي</Badge>;
  if (row.outcome === 'errored') return <Badge tone="danger">فشل</Badge>;

  if (row.classification === 'valid') return <Badge tone="success">صالح</Badge>;
  if (row.classification === 'active_collision') return <Badge tone="warning">تعارض نشط</Badge>;
  if (row.classification === 'archived_collision') return <Badge tone="neutral">تعارض مؤرشف</Badge>;
  if (row.classification === 'errored') {
    return (
      <span className="flex flex-col gap-0.5">
        <Badge tone="danger">خطأ</Badge>
        {row.error && (
          <span className="text-2xs text-terra-600">{row.error.messageAr}</span>
        )}
      </span>
    );
  }
  return <Badge tone="neutral">—</Badge>;
}

function RowValuesSummary({ row }: { row: ParsedRow }): JSX.Element {
  const entries = Object.entries(row.arabicValues).slice(0, 3);
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {entries.map(([k, v]) => (
        <span key={k} className="text-2xs text-ink-600">
          <span className="font-medium text-ink-900">{k}:</span> {v || '—'}
        </span>
      ))}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: ParsedRow['outcome'] }): JSX.Element | null {
  if (!outcome) return null;
  const MAP: Record<NonNullable<ParsedRow['outcome']>, { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
    created: { label: 'تم الإنشاء', tone: 'success' },
    updated: { label: 'تم التحديث', tone: 'success' },
    restored: { label: 'تمت الاستعادة', tone: 'success' },
    skipped: { label: 'تم التخطي', tone: 'neutral' },
    errored: { label: 'فشل', tone: 'danger' },
  };
  const entry = MAP[outcome];
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
