/**
 * lookup-import — public barrel
 *
 * Re-exports the full public surface used by ImportLookupModal and the
 * wiring code in LookupTab / ReferenceDataPage.
 */

export { parseImportFile } from './parse-import-file';
export { classifyImportRows, reclassifyRow } from './conflict-detector';
export type { ExistingRow } from './conflict-detector';
export { createImportRunner } from './import-runner';
export type { ImportRunner } from './import-runner';
export { buildTemplate, downloadBlob } from './template-writer';
export { ARABIC_SCHEMAS } from './arabic-schema';

export type {
  ImportLookupKey,
  ImportFileFormat,
  ImportRejection,
  ImportRejectionCode,
  RowClassification,
  RowOutcome,
  RowError,
  RowErrorCode,
  ActiveConflictResolution,
  ArchivedConflictResolution,
  ConflictResolution,
  ConflictDescriptor,
  BackendPayload,
  ParsedRow,
  ImportSummary,
  ImportPhase,
  ImportSession,
  EnumMap,
  ParentLookup,
  LookupSchema,
} from './types';
export { IMPORT_LOOKUP_PATH } from './types';
