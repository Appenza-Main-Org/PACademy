import type { DuplicateAudit, IntegrityAuditRow } from './duplicateAudit';
import type { ImportReport } from '../types';

const STORAGE_KEY = 'pa-applicant-grades-import-history-v1';
const MAX_HISTORY_RECORDS = 20;

export interface ApplicantGradesImportHistoryRecord {
  id: string;
  createdAt: string;
  fileName: string | null;
  graduationYear: number | null;
  totalRows: number;
  importedCount: number;
  skippedDuplicateCount: number;
  skippedInvalidCount: number;
  skippedExistingCount: number;
  failedCount: number;
  uniqueNidCount: number;
  duplicateNidGroups: number;
  duplicateRatio: number;
  loudDuplicateAck: boolean;
  auditCsv: string;
  integrityRows: IntegrityAuditRow[];
}

function readRaw(): ApplicantGradesImportHistoryRecord[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ApplicantGradesImportHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(records: readonly ApplicantGradesImportHistoryRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_HISTORY_RECORDS)));
}

export function listApplicantGradesImportHistory(): ApplicantGradesImportHistoryRecord[] {
  return readRaw().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getApplicantGradesImportHistoryRecord(
  id: string,
): ApplicantGradesImportHistoryRecord | null {
  return listApplicantGradesImportHistory().find((record) => record.id === id) ?? null;
}

export function saveApplicantGradesImportHistoryRecord(input: {
  fileName: string | null;
  graduationYear: number | null;
  report: ImportReport | null;
  audit: DuplicateAudit;
  integrityRows: readonly IntegrityAuditRow[];
  auditCsv: string;
  importedCount: number;
  skippedExistingCount: number;
  loudDuplicateAck: boolean;
}): ApplicantGradesImportHistoryRecord {
  const createdAt = new Date().toISOString();
  const safeStamp = createdAt
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replaceAll('.', '')
    .replaceAll('T', '')
    .replaceAll('Z', '')
    .slice(0, 14);
  const skippedInvalidCount = input.integrityRows.length;
  const record: ApplicantGradesImportHistoryRecord = {
    id: `AGR-IMPORT-${safeStamp}`,
    createdAt,
    fileName: input.fileName,
    graduationYear: input.graduationYear,
    totalRows: input.audit.totalRows,
    importedCount: input.importedCount,
    skippedDuplicateCount: input.audit.duplicateRowCount,
    skippedInvalidCount,
    skippedExistingCount: input.skippedExistingCount,
    failedCount: Math.max(input.report?.totals.failed ?? 0, skippedInvalidCount),
    uniqueNidCount: input.audit.uniqueNidCount,
    duplicateNidGroups: input.audit.duplicateNidGroups,
    duplicateRatio: input.audit.duplicateRatio,
    loudDuplicateAck: input.loudDuplicateAck,
    auditCsv: input.auditCsv,
    integrityRows: [...input.integrityRows],
  };
  writeRaw([record, ...readRaw().filter((item) => item.id !== record.id)]);
  return record;
}
