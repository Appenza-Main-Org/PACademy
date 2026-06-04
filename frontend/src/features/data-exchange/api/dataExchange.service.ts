/**
 * Data-Exchange service.
 *
 * INTEGRATION CONTRACT (admin backend `:5101`):
 *   GET  /api/admin/data-exchange/export?type=<csv|all>&layout=<single-workbook|file-per-type>&filter=<all|changedAfter|modifiedSinceCreation|sinceLastExport>&changedAfter=<iso>
 *   POST /api/admin/data-exchange/import/preview   body: { sheets: ImportSheetInput[] }
 *   POST /api/admin/data-exchange/import/apply      body: ImportApplyRequest
 *   GET  /api/admin/data-exchange/history
 *   GET  /api/admin/data-exchange/templates/:type
 *
 * Backend-first: `apiClient` by default. Mock fallback only when
 * `VITE_*_USE_MOCKS=true` (deterministic seed-42 data; reproduces the backend
 * checksum so preview classification is faithful). Named exports only; no `any`.
 */

import { apiClient, isBackendEnabled } from '@/shared/lib/api-client';
import { reseed, rng } from '@/shared/mock-data/seed';
import { computeRowChecksum } from '../lib/checksum';
import {
  type DataExchangeHistoryEntry,
  type DataExchangeTemplate,
  type ExchangeCellMap,
  type ExchangeDomain,
  type ExportFilter,
  type ExportLayout,
  type ExportResult,
  type ExportSheet,
  type ImportApplyRequest,
  type ImportApplyResult,
  type ImportPreview,
  type ImportRowOutcome,
  type ImportSheetInput,
  DOMAIN_TITLES_AR,
  SHEET_NAMES,
} from '../types';

const BASE = '/api/admin/data-exchange';

const TRACKING = ['created_at', 'updated_at', 'row_version', 'last_modified_by', 'source_system', 'checksum'];

export interface ExportParams {
  domains: ExchangeDomain[];
  layout: ExportLayout;
  filter: ExportFilter;
}

function exportQuery({ domains, layout, filter }: ExportParams): Record<string, string> {
  const query: Record<string, string> = {
    type: domains.length === Object.keys(SHEET_NAMES).length ? 'all' : domains.join(','),
    layout,
  };
  if (filter === 'all' || filter === 'modifiedSinceCreation' || filter === 'sinceLastExport') {
    query.filter = filter;
  } else if ('changedAfter' in filter) {
    query.filter = 'changedAfter';
    query.changedAfter = filter.changedAfter;
  } else {
    query.filter = 'all'; // cycleId / categoryKey scoping handled server-side where applicable
  }
  return query;
}

export const dataExchangeService = {
  async exportData(params: ExportParams): Promise<ExportResult> {
    if (isBackendEnabled()) {
      return apiClient.get<ExportResult>(`${BASE}/export`, { query: exportQuery(params) });
    }
    return mockExport(params);
  },

  async previewImport(sheets: ImportSheetInput[]): Promise<ImportPreview> {
    if (isBackendEnabled()) {
      return apiClient.post<ImportPreview>(`${BASE}/import/preview`, { sheets });
    }
    return mockPreview(sheets);
  },

  async applyImport(request: ImportApplyRequest): Promise<ImportApplyResult> {
    if (isBackendEnabled()) {
      return apiClient.post<ImportApplyResult>(`${BASE}/import/apply`, request);
    }
    return mockApply(request);
  },

  async history(): Promise<DataExchangeHistoryEntry[]> {
    if (isBackendEnabled()) {
      return apiClient.get<DataExchangeHistoryEntry[]>(`${BASE}/history`);
    }
    return [...mockHistory].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  async template(domain: ExchangeDomain): Promise<DataExchangeTemplate> {
    if (isBackendEnabled()) {
      return apiClient.get<DataExchangeTemplate>(`${BASE}/templates/${domain}`);
    }
    return {
      domain,
      sheetName: SHEET_NAMES[domain],
      titleAr: DOMAIN_TITLES_AR[domain],
      columns: mockColumns(domain),
    };
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Mock (seed-42 deterministic; checksum mirrors backend RowChecksum)
// ──────────────────────────────────────────────────────────────────────────

function mockColumns(domain: ExchangeDomain): string[] {
  // Normalized columns (no payload_json) — mirrors the backend's flattened export.
  const data: Record<ExchangeDomain, string[]> = {
    Applicants: ['nationalId', 'fullName', 'gender', 'status', 'examSlot.slotId', 'examSlot.date'],
    Exams: ['name_ar', 'cycle_id', 'status'],
    Relatives: ['applicantNationalId', 'name', 'kinship'],
    AcquaintanceDocs: ['applicantNationalId', 'docType', 'status'],
    Committees: ['categoryKey', 'capacity', 'reserved'],
    AdmissionConditions: ['cycle_id', 'version', 'minPercentage'],
    SystemCodes: ['lookup_key', 'code', 'name', 'is_active'],
    ExamResults: ['applicantNationalId', 'examId', 'result'],
    ExamSchedules: ['date', 'time', 'location', 'capacity', 'reserved'],
  };
  return ['id', 'business_key', ...data[domain], ...TRACKING];
}

interface MockRow {
  cells: ExchangeCellMap;
  businessKey: string;
  createdAt: string;
  updatedAt: string;
}

const mockStore: Partial<Record<ExchangeDomain, MockRow[]>> = {};
const mockHistory: DataExchangeHistoryEntry[] = [];

function seededStore(domain: ExchangeDomain): MockRow[] {
  if (mockStore[domain]) return mockStore[domain]!;
  reseed(42 + domain.length);
  const rows: MockRow[] = [];
  const count = domain === 'SystemCodes' ? 6 : domain === 'Applicants' ? 4 : 2;
  for (let i = 0; i < count; i += 1) rows.push(buildMockRow(domain, i));
  mockStore[domain] = rows;
  return rows;
}

/** Status values that mean the applicant has booked the first exam appointment
 *  (or progressed beyond it). Mirrors the backend `BookedOrLaterStatuses` gate. */
const BOOKED_OR_LATER_STATUSES = new Set<string>([
  'exam_scheduled',
  'attendance_card_available',
  'awaiting_exam_result',
  'under_medical_review',
  'passed_physical',
  'failed_interview',
  'awaiting_board_decision',
  'approved',
  'acquaintance_doc_opened',
  'under-review',
]);

function isApplicantBooked(cells: ExchangeCellMap): boolean {
  if (cells['examSlot.slotId'] || cells['examSlot.date']) return true;
  if (cells.examSlotId || cells.examScheduledAt) return true;
  const status = cells.status;
  return typeof status === 'string' && BOOKED_OR_LATER_STATUSES.has(status);
}

function buildMockRow(domain: ExchangeDomain, i: number): MockRow {
  const created = new Date(2026, 4, 1 + i).toISOString();
  const touched = i % 2 === 0; // every other row "modified since creation"
  const updated = touched ? new Date(2026, 4, 10 + i).toISOString() : created;
  const cells: ExchangeCellMap = {};
  let businessKey = '';

  if (domain === 'SystemCodes') {
    const code = `EXC-${String(i + 1).padStart(2, '0')}`;
    businessKey = `academic-grades|${code}`;
    cells.id = businessKey;
    cells.business_key = businessKey;
    cells.lookup_key = 'academic-grades';
    cells.code = code;
    cells.name = ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'ضعيف', 'راسب'][i] ?? code;
    cells.is_active = 'true';
  } else if (domain === 'Applicants') {
    const nid = `2980101${String(1000000 + Math.floor(rng() * 8999999)).slice(0, 7)}`;
    businessKey = nid;
    cells.id = `APP-${i + 1}`;
    cells.business_key = nid;
    cells.nationalId = nid;
    cells.fullName = `متقدم ${i + 1}`;
    cells.gender = i % 2 === 0 ? 'male' : 'female';
    // Demo seed reflects the export-eligibility gate: half the applicants have
    // booked the first exam appointment (exportable), the other half are still
    // mid-flow (withheld). Mirrors the backend `IsApplicantBooked` predicate.
    const isBooked = i % 2 === 0;
    cells.status = isBooked ? 'exam_scheduled' : 'awaiting_exam_booking';
    if (isBooked) {
      cells['examSlot.slotId'] = `SLOT-${i + 1}`;
      cells['examSlot.date'] = `2026-06-${String(12 + i).padStart(2, '0')}`;
    }
  } else {
    const id = `${domain}-${i + 1}`;
    businessKey = id;
    cells.id = id;
    cells.business_key = id;
    // Fill the domain's normalized columns with deterministic sample values.
    for (const col of mockColumns(domain)) {
      if (col === 'id' || col === 'business_key' || TRACKING.includes(col)) continue;
      cells[col] = col === 'capacity' ? '30' : col === 'reserved' ? String(10 + i) : `${col}-${i + 1}`;
    }
  }

  cells.created_at = created;
  cells.updated_at = updated;
  cells.row_version = '';
  cells.last_modified_by = 'system';
  cells.source_system = 'appenza-admin';
  return { cells, businessKey, createdAt: created, updatedAt: updated };
}

async function withChecksum(domain: ExchangeDomain, row: MockRow): Promise<ExchangeCellMap> {
  const cols = mockColumns(domain).filter((c) => !TRACKING.includes(c) && c !== 'id');
  const pairs: Array<[string, string | null]> = cols.map((c) => [c, row.cells[c] ?? null]);
  const checksum = await computeRowChecksum(pairs);
  return { ...row.cells, checksum };
}

async function mockExport({ domains, layout, filter }: ExportParams): Promise<ExportResult> {
  const sheets: ExportSheet[] = [];
  let total = 0;
  for (const domain of domains) {
    let rows = seededStore(domain);
    // Applicants are only exported once the first exam appointment is booked.
    // Mirrors the backend `IsApplicantBooked` gate so the mock path matches.
    if (domain === 'Applicants') rows = rows.filter((r) => isApplicantBooked(r.cells));
    if (filter === 'modifiedSinceCreation') rows = rows.filter((r) => r.updatedAt !== r.createdAt);
    else if (typeof filter === 'object' && 'changedAfter' in filter) {
      rows = rows.filter((r) => r.updatedAt >= filter.changedAfter);
    }
    const cells = await Promise.all(rows.map((r) => withChecksum(domain, r)));
    total += cells.length;
    sheets.push({
      domain,
      sheetName: SHEET_NAMES[domain],
      titleAr: DOMAIN_TITLES_AR[domain],
      columns: mockColumns(domain),
      rows: cells,
    });
  }
  mockHistory.unshift(historyEntry('export', `تصدير ${sheets.length} ورقة · ${total} صف`, total, 0, 0, 0, 0));
  return { layout, watermark: new Date().toISOString(), totalRows: total, sheets };
}

function findDomain(sheetName: string): ExchangeDomain | null {
  const entry = (Object.entries(SHEET_NAMES) as Array<[ExchangeDomain, string]>).find(([, s]) => s === sheetName);
  return entry ? entry[0] : null;
}

async function classify(sheet: ImportSheetInput): Promise<{ outcomes: ImportRowOutcome[]; domain: ExchangeDomain | null }> {
  const domain = findDomain(sheet.sheetName);
  if (!domain) return { outcomes: [], domain: null };
  const store = seededStore(domain);
  const cols = mockColumns(domain).filter((c) => !TRACKING.includes(c) && c !== 'id');
  const checksumCols = ['business_key', ...cols.filter((c) => c !== 'business_key')];
  const dbByKey = new Map<string, MockRow>(store.map((r) => [r.businessKey, r]));
  const seen = new Set<string>();
  const outcomes: ImportRowOutcome[] = [];

  for (let i = 0; i < sheet.rows.length; i += 1) {
    const row = sheet.rows[i];
    const bk = row.business_key ?? row.id ?? '';
    if (!bk) {
      outcomes.push(outcome(domain, sheet.sheetName, i, bk, 'invalid', ['مفتاح مفقود']));
      continue;
    }
    if (seen.has(bk)) {
      outcomes.push(outcome(domain, sheet.sheetName, i, bk, 'invalid', ['مفتاح مكرر داخل الملف']));
      continue;
    }
    seen.add(bk);

    const db = dbByKey.get(bk);
    if (!db) {
      outcomes.push(outcome(domain, sheet.sheetName, i, bk, 'new'));
      continue;
    }
    const dbChecksum = await computeRowChecksum(checksumCols.map((c) => [c, db.cells[c] ?? null]));
    const importChecksum = await computeRowChecksum(checksumCols.map((c) => [c, row[c] ?? null]));
    if (dbChecksum === importChecksum) {
      outcomes.push(outcome(domain, sheet.sheetName, i, bk, 'skipped'));
      continue;
    }
    const importUpdated = row.updated_at ?? '';
    const dbNewer = importUpdated !== '' && db.updatedAt > importUpdated;
    outcomes.push(outcome(domain, sheet.sheetName, i, bk, dbNewer ? 'outdated' : 'changed'));
  }
  return { outcomes, domain };
}

async function mockPreview(sheets: ImportSheetInput[]): Promise<ImportPreview> {
  const allOutcomes: ImportRowOutcome[] = [];
  const sheetIssues: ImportPreview['sheetIssues'] = [];
  for (const sheet of sheets) {
    const { outcomes, domain } = await classify(sheet);
    if (!domain) {
      sheetIssues.push({ sheetName: sheet.sheetName, code: 'DATA_EXCHANGE_INVALID_WORKBOOK', message: `اسم ورقة غير معروف: ${sheet.sheetName}` });
      continue;
    }
    allOutcomes.push(...outcomes);
  }
  const counts: Record<string, number> = {};
  for (const cls of ['new', 'changed', 'skipped', 'outdated', 'conflict', 'invalid']) {
    counts[cls] = allOutcomes.filter((o) => o.class === cls).length;
  }
  return { counts, rows: allOutcomes, sheetIssues };
}

async function mockApply(request: ImportApplyRequest): Promise<ImportApplyResult> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let attempted = 0;
  const failedRows: ImportApplyResult['failedRows'] = [];
  const applyChanged = request.mode === 'new-and-changed';

  for (const sheet of request.sheets) {
    const { outcomes, domain } = await classify(sheet);
    if (!domain) continue;
    const store = seededStore(domain);
    for (let i = 0; i < sheet.rows.length; i += 1) {
      const o = outcomes[i];
      attempted += 1;
      const row = sheet.rows[i];
      const apply = () => {
        const existing = store.find((r) => r.businessKey === o.businessKey);
        const created = existing?.createdAt ?? new Date().toISOString();
        const next: MockRow = { cells: { ...row }, businessKey: o.businessKey, createdAt: created, updatedAt: new Date().toISOString() };
        if (existing) Object.assign(existing, next);
        else store.push(next);
      };
      if (o.class === 'new') { apply(); inserted += 1; }
      else if (o.class === 'changed' && applyChanged) { apply(); updated += 1; }
      else if (o.class === 'outdated' && request.forceUpdate) { apply(); updated += 1; }
      else if (o.class === 'invalid') failedRows.push({ rowIndex: i, sheetName: sheet.sheetName, errors: o.errors });
      else if (o.class === 'conflict' && !request.skipConflicts) failedRows.push({ rowIndex: i, sheetName: sheet.sheetName, errors: ['تعارض — لم يُطبَّق'] });
      else skipped += 1;
    }
  }
  mockHistory.unshift(historyEntry('import', `استيراد · ${inserted} إضافة · ${updated} تحديث`, attempted, inserted, updated, skipped, failedRows.length));
  return { attemptedCount: attempted, successCount: inserted + updated, insertedCount: inserted, updatedCount: updated, skippedCount: skipped, failedCount: failedRows.length, failedRows };
}

function outcome(domain: ExchangeDomain, sheetName: string, rowIndex: number, businessKey: string, cls: ImportRowOutcome['class'], errors: string[] = []): ImportRowOutcome {
  return { domain, sheetName, rowIndex, businessKey, class: cls, errors };
}

let historySeq = 0;
function historyEntry(action: string, details: string, total: number, inserted: number, updated: number, skipped: number, failed: number): DataExchangeHistoryEntry {
  historySeq += 1;
  return {
    id: `DATAX-MOCK-${historySeq}`,
    action,
    actorName: 'النظام',
    details,
    total,
    inserted,
    updated,
    skipped,
    failed,
    timestamp: new Date(Date.now() + historySeq).toISOString(),
  };
}
