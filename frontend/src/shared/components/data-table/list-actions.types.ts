/**
 * Type contracts for the universal list-actions stack —
 * `ListActions` / `ImportDialog` / `ExportMenu` / `DuplicateAction`.
 *
 * Each list page declares a `ListActionsConfig<TRow>` whose `export`,
 * `import`, and `duplicate` sub-configs are independently opt-in. Lists
 * that omit `listActions` render the existing toolbar verbatim — there is
 * no implicit default, no broken UI.
 */

import type { ReactNode } from 'react';
import type { ZodSchema } from 'zod';
import type { XlsxWorkbookSheet } from '@/shared/lib/xlsx';
import type { AuditModule } from '@/shared/types/domain';

export type ExportFormat = 'csv' | 'xlsx';

export interface ExportColumn<TRow> {
  /** Source key — keyof TRow for direct accessors, free string for derived. */
  key: keyof TRow & string;
  labelAr: string;
  /**
   * Optional row-level formatter. Receives the raw value at `row[key]`
   * and the full row for context (array joins, status maps, etc.).
   */
  format?: (value: unknown, row: TRow) => string;
}

export interface ExportConfig<TRow> {
  enabled: boolean;
  /** Permitted output formats. CSV always recommended; XLSX is optional. */
  formats: ReadonlyArray<ExportFormat>;
  columns: ReadonlyArray<ExportColumn<TRow>>;
  /** Filename prefix (Arabic OK). Suffixed with the ISO date. */
  filenamePrefix: string;
  /**
   * Default scope. `filtered` (default) exports the rows currently passed
   * to `DataTable`. `all` exports every row from a supplier. The
   * `ExportMenu` UI lets the user flip this; pass `allSupplier` so the
   * UI can do so without re-running filters.
   */
  defaultScope?: 'filtered' | 'all';
  /** Async supplier for "تصدير الكل" — defaults to the current `rows`. */
  allSupplier?: () => Promise<readonly TRow[]> | readonly TRow[];
  /** Async supplier for "النتائج المُصفّاة" when the table is server-paginated. */
  filteredSupplier?: () => Promise<readonly TRow[]> | readonly TRow[];
  /** Optional export-only filter. Does not affect the table rows shown on screen. */
  rowFilter?: (row: TRow) => boolean;
  /** Optional XLSX workbook builder. CSV keeps using `columns`; XLSX can emit tabs. */
  xlsxSheets?: (rows: readonly TRow[]) => Promise<readonly XlsxWorkbookSheet[]> | readonly XlsxWorkbookSheet[];
}

export interface ImportPreviewRow<TIn = unknown> {
  rowIndex: number;
  /** Cell map keyed by the source header label (verbatim from CSV/XLSX). */
  source: Record<string, string>;
  /** Parsed / coerced payload — populated when validation succeeds. */
  parsed?: TIn;
  errors: ReadonlyArray<string>;
}

export interface ImportResult {
  attemptedCount: number;
  successCount: number;
  failedRows: ReadonlyArray<{ rowIndex: number; errors: ReadonlyArray<string> }>;
}

export type ImportConflictMode = 'skip' | 'merge' | 'restore-or-create';

export interface ImportConfig<TIn> {
  enabled: boolean;
  formats: ReadonlyArray<ExportFormat>;
  /** Per-row schema. Cells arrive as `Record<string,string>` (header → value). */
  schema: ZodSchema<TIn>;
  /** Optional canonical header order (used by the "download template" link). */
  templateColumns?: ReadonlyArray<{ key: string; labelAr: string; sample?: string }>;
  /** Commit the (successful) parsed rows. Returns the import result. */
  onCommit: (rows: TIn[]) => Promise<ImportResult>;
  /** Override the default `entity_imported` audit detail when needed. */
  onConflict?: ImportConflictMode;
  /** Optional per-cell coercion / header mapping. Runs before zod parse. */
  mapRow?: (raw: Record<string, string>) => Record<string, unknown>;
}

export interface DuplicateConfig<TRow> {
  enabled: boolean;
  /**
   * Strip identity-bearing + soft-delete fields, suffix label with `-نسخة`,
   * reset any uniqueness-violating fields. Pure — no IO.
   */
  transform: (row: TRow) => Partial<TRow>;
  /** Persist the duplicated draft and return the saved row. */
  onCommit: (draft: Partial<TRow>, sourceRow: TRow) => Promise<TRow>;
  /** Where to navigate after commit. Defaults to `(row) => undefined` (no navigation). */
  redirectTo?: (row: TRow) => string | undefined;
  /**
   * Hook a row-level predicate that blocks duplicate. Receives the row;
   * returning a non-null Arabic reason renders an error toast instead.
   */
  guard?: (row: TRow) => string | null;
}

export interface DeletedDataConfig<TRow> {
  enabled: boolean;
  /** Whether the host page is currently listing soft-deleted records. */
  isShowing: boolean;
  /** Toggle deleted-record visibility. Host pages own refetch/query params. */
  onToggle: (next: boolean) => void;
  /** Row predicate used by DataTable to apply the deleted visual treatment. */
  isDeleted: (row: TRow) => boolean;
  /** Optional count shown beside the button when known. */
  deletedCount?: number;
}

export interface RowActionsConfig<TRow> {
  /** Header label for the trailing actions column. */
  labelAr?: string;
  /** Fixed column width; defaults to a compact icon-menu column. */
  width?: string | number;
  /** Pin the actions column at the inline-end edge so it stays visible
   *  while the rest of the table scrolls horizontally. Pair with a
   *  `tableClassName` min-width on the host `DataTable`. */
  sticky?: boolean;
  /** Render the row-level action primitive for this row. */
  render: (row: TRow) => ReactNode;
}

export interface ListActionsConfig<TRow> {
  /** `<surface>.<entity>` — e.g. `admin.users`. Drives audit + permissions. */
  entityKey: string;
  /** Arabic label rendered in dialog titles, toasts, and tooltips. */
  entityLabelAr: string;
  /** Audit module under which export/import/duplicate events are filed. */
  auditModule: AuditModule;
  export?: ExportConfig<TRow>;
  import?: ImportConfig<unknown>;
  duplicate?: DuplicateConfig<TRow>;
  deleted?: DeletedDataConfig<TRow>;
  rowActions?: RowActionsConfig<TRow>;
}

/* ── Public helpers shared by the primitives ─────────────────────────── */

export interface ExportSliceArgs<TRow> {
  rows: readonly TRow[];
  config: ExportConfig<TRow>;
}

export interface ImportSliceArgs {
  config: ImportConfig<unknown>;
}

export interface DuplicateSliceArgs<TRow> {
  row: TRow;
  config: DuplicateConfig<TRow>;
}

/**
 * Returns the toolbar label for a single action, mirroring the prompt's
 * Arabic copy. Centralised here so the menu, the row action, and the
 * keyboard tooltips stay in sync.
 */
export const ACTION_LABELS = {
  export: 'تصدير',
  import: 'استيراد',
  duplicate: 'نسخ',
  showDeleted: 'عرض المحذوفات',
  hideDeleted: 'إخفاء المحذوفات',
} as const satisfies Record<'export' | 'import' | 'duplicate' | 'showDeleted' | 'hideDeleted', string>;

/** Render-time slot rendered by the `DataTable` toolbar. */
export interface ListActionsToolbarSlot {
  buttons: ReactNode;
}
