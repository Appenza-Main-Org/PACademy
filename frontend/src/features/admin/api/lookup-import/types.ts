/**
 * lookup-import/types.ts
 *
 * All in-memory types for one upload-preview-commit cycle.
 * Nothing here is persisted; the entire object graph lives on the React
 * component tree for the lifetime of the modal.
 *
 * ImportLookupKey covers all 21 lookup tables the importer can target:
 *   - 8 Sprint-1 typed lookups (ReferenceTab shape)
 *   - 13 Gap-I generic lookups (LookupRow shape)
 */

/** All 21 lookup types the importer handles (camelCase throughout). */
export type ImportLookupKey =
  | 'governorates'
  | 'specializations'
  | 'ranks'
  | 'colleges'
  | 'qualifications'
  | 'nationalities'
  | 'relationships'
  | 'caseTypes'
  | 'educationTypes'
  | 'maritalStatuses'
  | 'universities'
  | 'faculties'
  | 'specialties'
  | 'specialtyTypes'
  | 'degreeTypes'
  | 'jobs'
  | 'examTypes'
  | 'examGroups'
  | 'committeeTypes'
  | 'rejectionReasons'
  | 'notificationDepartments';

/** REST resource path per lookup key. */
export const IMPORT_LOOKUP_PATH: Record<ImportLookupKey, string> = {
  governorates: '/admin/governorates',
  specializations: '/admin/specializations',
  ranks: '/admin/ranks',
  colleges: '/admin/colleges',
  qualifications: '/admin/qualifications',
  nationalities: '/admin/nationalities',
  relationships: '/admin/relationships',
  caseTypes: '/admin/case-types',
  educationTypes: '/admin/education-types',
  maritalStatuses: '/admin/marital-statuses',
  universities: '/admin/universities',
  faculties: '/admin/faculties',
  specialties: '/admin/specialties',
  specialtyTypes: '/admin/specialty-types',
  degreeTypes: '/admin/degree-types',
  jobs: '/admin/jobs',
  examTypes: '/admin/exam-types',
  examGroups: '/admin/exam-groups',
  committeeTypes: '/admin/committee-types',
  rejectionReasons: '/admin/rejection-reasons',
  notificationDepartments: '/admin/notification-departments',
};

/** File format detected by extension + MIME. */
export type ImportFileFormat = 'xlsx' | 'csv';

/** Reasons the whole file is rejected before showing any preview. */
export type ImportRejectionCode =
  | 'too_large'
  | 'too_many_rows'
  | 'unsupported_format'
  | 'corrupted'
  | 'empty'
  | 'schema_mismatch';

export interface ImportRejection {
  code: ImportRejectionCode;
  /** Arabic sentence shown to the admin. */
  messageAr: string;
}

/**
 * Where the conflict-detector classified this row after both passes.
 *
 * - `valid`:             Shape OK, no collision. Will be `created` on commit.
 * - `active_collision`:  Key matches an existing active row.
 * - `archived_collision`:Key matches an existing soft-deleted row.
 * - `errored`:           Failed shape or FK validation.
 */
export type RowClassification =
  | 'valid'
  | 'active_collision'
  | 'archived_collision'
  | 'errored';

/** Outcome written by the runner after commit. */
export type RowOutcome = 'created' | 'updated' | 'restored' | 'skipped' | 'errored';

/** Discriminated error codes attached to errored rows. */
export type RowErrorCode =
  | 'missing_required'
  | 'invalid_key'
  | 'unknown_enum'
  | 'fk_not_found'
  | 'fk_archived'
  | 'duplicate_in_file'
  | 'http_failure';

export interface RowError {
  code: RowErrorCode;
  /** Arabic header of the offending column (when applicable). */
  column: string | null;
  /** Single Arabic sentence rendered in the preview. */
  messageAr: string;
  httpStatus?: number;
}

/** Per-row resolution for active_collision rows. */
export type ActiveConflictResolution = 'skip' | 'update' | 'abort';

/** Per-row resolution for archived_collision rows (FR-008a). */
export type ArchivedConflictResolution = 'skip' | 'restore_update' | 'rename_required';

export type ConflictResolution = ActiveConflictResolution | ArchivedConflictResolution;

export interface ConflictDescriptor {
  type: 'active_collision' | 'archived_collision';
  /** The clashing row's backend id (for PATCH / restore URL). */
  existingId: string;
  /** Snapshot of the existing row's mutable fields for diff display. */
  existingValues: Record<string, unknown>;
}

/** The payload the runner sends to the backend for this row. */
export type BackendPayload = Record<string, unknown>;

/**
 * One row from the uploaded file, after both validation passes.
 *
 * `resolution` is set by the admin in the preview UI for conflicted rows.
 * `outcome` is set by the runner after commit.
 */
export interface ParsedRow {
  /** 0-based position in the source file (header excluded). React key + error label. */
  index: number;
  /** Raw column → cell value keyed by Arabic header. Preserved verbatim for display. */
  arabicValues: Record<string, string>;
  /** Ready-to-send backend body; null when shape validation failed. */
  payload: BackendPayload | null;
  classification: RowClassification;
  conflict: ConflictDescriptor | null;
  resolution: ConflictResolution | null;
  outcome: RowOutcome | null;
  error: RowError | null;
}

/** Per-import-session summary populated after the commit run. */
export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  restored: number;
  skipped: number;
  errored: number;
  /** Errored rows for the expandable details panel. */
  errors: ParsedRow[];
  durationMs: number;
}

/**
 * Root state machine for one upload-preview-commit cycle.
 *
 * Phase transitions: idle → parsing → preview → committing → done
 *                         (any phase) ↓
 *                                  cancelled (terminal)
 */
export type ImportPhase = 'idle' | 'parsing' | 'preview' | 'committing' | 'done' | 'cancelled';

export interface ImportSession {
  id: string;
  lookupKey: ImportLookupKey;
  fileName: string;
  fileFormat: ImportFileFormat;
  fileSizeBytes: number;
  phase: ImportPhase;
  rows: ParsedRow[];
  summary: ImportSummary | null;
  startedAt: string | null;
  completedAt: string | null;
}

/** Bidirectional Arabic ↔ backend enum mapping for one column. */
export interface EnumMap {
  /** Arabic display value → backend enum string. */
  forwardArToBackend: Record<string, string>;
  /** Backend enum string → Arabic display value (for template example row). */
  reverseBackendToAr: Record<string, string>;
}

/** Resolution context for hierarchical lookups (faculties → universities, etc.). */
export interface ParentLookup {
  active: Map<string, string>;   // parent key → parent id (Guid)
  archived: Map<string, string>; // parent key → parent id
}

/**
 * Per-lookup static schema — the single source of truth for:
 *   - template generator (headers + example)
 *   - file parser (validates required headers)
 *   - shape validator (validates each cell)
 *   - row mapper (produces BackendPayload)
 *
 * Exported from arabic-schema.ts as ARABIC_SCHEMAS[key].
 */
export interface LookupSchema {
  lookupKey: ImportLookupKey;
  /**
   * Arabic header strings that MUST be present in row 1 of the file.
   * Missing any of these → ImportRejection 'schema_mismatch'.
   */
  requiredHeaders: readonly string[];
  /**
   * Arabic header strings that are allowed but not required.
   */
  optionalHeaders: readonly string[];
  /**
   * Non-null for hierarchical lookups.
   * 'faculties' → 'universities'; 'specialties' → 'specialtyTypes'
   */
  parentLookup: ImportLookupKey | null;
  /**
   * For each Arabic header that maps to an enum: forward + reverse mapping.
   * e.g., 'الإقليم' → { forwardArToBackend: { 'القاهرة الكبرى': 'Cairo', ... } }
   */
  enums: Record<string, EnumMap>;
  /**
   * Pure function: maps a row's Arabic header → cell value record to the
   * BackendPayload that goes to the REST endpoint.
   *
   * @throws {Error} with an Arabic message when the shape is invalid.
   * Caller catches and converts to RowError.
   */
  mapRow(
    arabic: Record<string, string>,
    parents: ParentLookup,
    sortOrderBase: number,
  ): BackendPayload;
  /**
   * A sample row (Arabic values) used by the template writer for row 2.
   * Must satisfy all required + optional headers.
   */
  exampleRow: Record<string, string>;
  /**
   * Derive a collision key from a row's Arabic values.
   * For Gap-I lookups: the 'المفتاح' column.
   * For Sprint-1 typed lookups: 'الاسم بالعربية' (name-based collision).
   */
  getCollisionKey(arabic: Record<string, string>): string;
  /**
   * Derive a collision key from an existing backend row snapshot.
   * Mirrors getCollisionKey but on the backend-fetched row data.
   */
  getExistingKey(row: Record<string, unknown>): string;
}
