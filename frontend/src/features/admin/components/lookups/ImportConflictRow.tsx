/**
 * ImportConflictRow — per-row resolution control for conflicting import rows.
 *
 * Renders inside ImportLookupPreview for rows classified as:
 *   - active_collision:   Skip / Update / Abort
 *   - archived_collision: Skip / Restore+Update / Rename
 *
 * Usage:
 *   <ImportConflictRow row={row} onResolutionChange={handleChange} disabled={committing} />
 */

import { cn } from '@/shared/lib/cn';
import type { ActiveConflictResolution, ArchivedConflictResolution, ParsedRow } from '../../api/lookup-import';

interface ImportConflictRowProps {
  row: ParsedRow;
  onResolutionChange: (rowIndex: number, resolution: ActiveConflictResolution | ArchivedConflictResolution) => void;
  disabled?: boolean;
}

/** Renders the resolution radio-button strip for one conflicted row. */
export function ImportConflictRow({ row, onResolutionChange, disabled = false }: ImportConflictRowProps): JSX.Element {
  if (row.classification === 'active_collision') {
    return (
      <ActiveConflictControls
        row={row}
        onResolutionChange={onResolutionChange}
        disabled={disabled}
      />
    );
  }
  if (row.classification === 'archived_collision') {
    return (
      <ArchivedConflictControls
        row={row}
        onResolutionChange={onResolutionChange}
        disabled={disabled}
      />
    );
  }
  return <span className="text-2xs text-ink-400">—</span>;
}

/* ─── active_collision ──────────────────────────────────────────────────── */

function ActiveConflictControls({
  row,
  onResolutionChange,
  disabled,
}: {
  row: ParsedRow;
  onResolutionChange: ImportConflictRowProps['onResolutionChange'];
  disabled: boolean;
}): JSX.Element {
  const current = row.resolution ?? null;

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={`خيار معالجة الصف ${row.index + 2}`}>
      {(['skip', 'update', 'abort'] as ActiveConflictResolution[]).map((opt) => (
        <ResolutionChip
          key={opt}
          label={ACTIVE_LABELS[opt]}
          selected={current === opt}
          danger={opt === 'abort'}
          disabled={disabled}
          onClick={() => onResolutionChange(row.index, opt)}
        />
      ))}
    </div>
  );
}

const ACTIVE_LABELS: Record<ActiveConflictResolution, string> = {
  skip: 'تخطي',
  update: 'تحديث',
  abort: 'إيقاف الكل',
};

/* ─── archived_collision ────────────────────────────────────────────────── */

function ArchivedConflictControls({
  row,
  onResolutionChange,
  disabled,
}: {
  row: ParsedRow;
  onResolutionChange: ImportConflictRowProps['onResolutionChange'];
  disabled: boolean;
}): JSX.Element {
  const current = row.resolution ?? 'skip';

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={`خيار معالجة الصف ${row.index + 2}`}>
      {(['skip', 'restore_update', 'rename_required'] as ArchivedConflictResolution[]).map((opt) => (
        <ResolutionChip
          key={opt}
          label={ARCHIVED_LABELS[opt]}
          selected={current === opt}
          disabled={disabled}
          onClick={() => onResolutionChange(row.index, opt)}
        />
      ))}
    </div>
  );
}

const ARCHIVED_LABELS: Record<ArchivedConflictResolution, string> = {
  skip: 'تخطي',
  restore_update: 'استعادة وتحديث',
  rename_required: 'تغيير المفتاح',
};

/* ─── shared chip ───────────────────────────────────────────────────────── */

function ResolutionChip({
  label,
  selected,
  danger = false,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  danger?: boolean;
  disabled: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2 py-0.5 text-2xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
        disabled && 'cursor-not-allowed opacity-50',
        selected && !danger && 'border-teal-500 bg-teal-50 text-teal-700',
        selected && danger && 'border-terra-500 bg-terra-50 text-terra-700',
        !selected && 'border-border-subtle bg-surface-card text-ink-600 hover:border-ink-300 hover:text-ink-900',
      )}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}
