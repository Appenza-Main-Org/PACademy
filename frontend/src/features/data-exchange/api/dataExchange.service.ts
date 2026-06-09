/**
 * Data-Exchange service.
 *
 * INTEGRATION CONTRACT (admin backend `:5101`):
 *   GET  /api/admin/data-exchange/export?type=<csv|all>&layout=<single-workbook|file-per-type>&filter=<all|changedAfter|modifiedSinceCreation|sinceLastExport>&changedAfter=<iso>&cycleId=<id>
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
  type ApplicantFieldDiff,
  type ApplicantReconciliationCommitRequest,
  type ApplicantReconciliationCommitResult,
  type ApplicantReconciliationPreview,
  type ApplicantReconciliationRow,
  type ApplicantRosterRow,
  type ApplicantWritebackResult,
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
  /** Admin-selected applicant NIDs from the roster panel. When omitted, the
   *  export honors the unfiltered booked roster. Only meaningful when the
   *  `Applicants` domain is selected. */
  nationalIds?: readonly string[];
  /** Optional selected admission cycle. When omitted, the backend scopes
   *  applicant export/roster data to the active cycle. */
  cycleId?: string;
}

function exportQuery({ domains, layout, filter, nationalIds, cycleId }: ExportParams): Record<string, string> {
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
  if (nationalIds && nationalIds.length > 0) {
    query.nationalIds = nationalIds.join(',');
  }
  if (cycleId) {
    query.cycleId = cycleId;
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

  async listBookedApplicants(): Promise<ApplicantRosterRow[]> {
    if (isBackendEnabled()) {
      return apiClient.get<ApplicantRosterRow[]>(`${BASE}/applicants/roster`);
    }
    return mockRoster();
  },

  async previewApplicantsReconciliation(
    sheet: ImportSheetInput,
  ): Promise<ApplicantReconciliationPreview> {
    if (isBackendEnabled()) {
      return apiClient.post<ApplicantReconciliationPreview>(
        `${BASE}/applicants/reconcile/preview`,
        sheet,
      );
    }
    return mockReconcilePreview(sheet);
  },

  async commitApplicantsReconciliation(
    request: ApplicantReconciliationCommitRequest,
  ): Promise<ApplicantReconciliationCommitResult> {
    if (isBackendEnabled()) {
      return apiClient.post<ApplicantReconciliationCommitResult>(
        `${BASE}/applicants/reconcile/commit`,
        request,
      );
    }
    return mockReconcileCommit(request);
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Mock (seed-42 deterministic; checksum mirrors backend RowChecksum)
// ──────────────────────────────────────────────────────────────────────────

function mockColumns(domain: ExchangeDomain): string[] {
  // Normalized columns (no payload_json) — mirrors the backend's flattened export.
  const data: Record<ExchangeDomain, string[]> = {
    Applicants: ['nationalId', 'fullName', 'gender', 'status', 'examSlot.slotId', 'examSlot.date', 'examSlot.time', 'examSlot.location'],
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

function mockRoster(): ApplicantRosterRow[] {
  return seededStore('Applicants')
    .filter((r) => isApplicantBooked(r.cells))
    .map((r) => ({
      nationalId: r.cells.nationalId ?? r.businessKey,
      applicantId: r.cells.id ?? r.businessKey,
      fullName: r.cells.fullName ?? null,
      gender: r.cells.gender ?? null,
      status: r.cells.status ?? null,
      examSlotDate: r.cells['examSlot.date'] ?? null,
      examSlotTime: r.cells['examSlot.time'] ?? null,
      committeeName: r.cells.committeeName ?? r.cells.committee ?? null,
      examSlotLocation: r.cells['examSlot.location'] ?? null,
      updatedAt: r.updatedAt,
    }));
}

/** Editable fields the admin may correct in the round-trip Excel. Mirrors
 *  backend `EditableApplicantFields`. */
const EDITABLE_APPLICANT_FIELDS = new Set<string>([
  'fullName', 'name', 'gender', 'phoneNumber', 'mobile', 'email',
  'religion', 'birthDate', 'birthGovernorate', 'birthDistrict',
  'maritalStatus', 'governorate', 'city',
  'address.governorate', 'address.city', 'address.detail', 'address.street',
]);

const WRITEBACK_COLUMNS = new Set<string>(['result', 'next_exam_date', 'round', 'test_code']);

/** Reverse-map of result phrasings → canonical FollowUpOutcomes value.
 *  Mirrors backend `LoadResultLookupAsync` + `MapOutcomeToFollowUp`. */
const RESULT_LOOKUP = new Map<string, string>([
  ['RES-01', 'passed'], ['RES-02', 'failed'], ['RES-03', 'in-progress'], ['RES-04', 'failed'],
  ['ناجح', 'passed'], ['راسب', 'failed'], ['مؤجل', 'in-progress'], ['منسحب', 'failed'],
  ['pass', 'passed'], ['fail', 'failed'], ['defer', 'in-progress'], ['withdrawn', 'failed'],
  ['passed', 'passed'], ['failed', 'failed'], ['in-progress', 'in-progress'],
  ['awaiting-approval', 'awaiting-approval'], ['pending', 'pending'],
]);

function mockParseWriteback(row: ExchangeCellMap): ApplicantWritebackResult {
  const raw = row.result ?? null;
  const testCode = row.test_code ?? null;
  const nextExamDate = row.next_exam_date ?? null;
  const roundRaw = row.round ?? null;
  const round = roundRaw && /^\d+$/.test(roundRaw) ? Number.parseInt(roundRaw, 10) : null;
  const errors: string[] = [];
  if (raw == null || raw.trim() === '') {
    return { resultRaw: raw, outcome: null, testCode, round, nextExamDate, errors };
  }
  const outcome = RESULT_LOOKUP.get(raw.trim()) ?? null;
  if (!outcome) {
    errors.push('RESULT_VALUE_UNKNOWN');
    return { resultRaw: raw, outcome: null, testCode, round, nextExamDate, errors };
  }
  if (outcome === 'passed' && (nextExamDate == null || nextExamDate.trim() === '')) {
    errors.push('WRITEBACK_NEXT_EXAM_MISSING');
  }
  return { resultRaw: raw, outcome, testCode, round, nextExamDate, errors };
}

function mockReconcilePreview(sheet: ImportSheetInput): ApplicantReconciliationPreview {
  const roster = mockRoster();
  const byNid = new Map(roster.map((r) => [r.nationalId, r]));
  const dbCells = new Map(
    seededStore('Applicants')
      .filter((r) => isApplicantBooked(r.cells))
      .map((r) => [r.cells.nationalId ?? r.businessKey, r.cells]),
  );
  const seen = new Set<string>();
  const rows: ApplicantReconciliationRow[] = [];

  for (const importRow of sheet.rows) {
    const nid = importRow.nationalId ?? importRow.business_key ?? '';
    const errors: string[] = [];
    if (!nid) {
      errors.push('الرقم القومي مفقود');
      rows.push({ nationalId: '', applicantId: null, fullName: null, unmatched: true, fieldDiffs: [], writeback: null, errors });
      continue;
    }
    if (seen.has(nid)) {
      errors.push('مفتاح مكرر داخل الملف');
      rows.push({ nationalId: nid, applicantId: null, fullName: null, unmatched: false, fieldDiffs: [], writeback: null, errors });
      continue;
    }
    seen.add(nid);
    const writeback = mockParseWriteback(importRow);
    const matched = byNid.get(nid);
    if (!matched) {
      rows.push({
        nationalId: nid, applicantId: null,
        fullName: importRow.fullName ?? importRow.name ?? null,
        unmatched: true, fieldDiffs: [], writeback,
        errors: ['APPLICANT_NID_UNMATCHED'],
      });
      continue;
    }
    const dbRow = dbCells.get(nid) ?? {};
    const fieldDiffs: ApplicantFieldDiff[] = [];
    for (const [field, importedRaw] of Object.entries(importRow)) {
      if (!EDITABLE_APPLICANT_FIELDS.has(field)) continue;
      if (WRITEBACK_COLUMNS.has(field)) continue;
      const imported = importedRaw?.trim();
      if (!imported) continue;
      const current = (dbRow[field] ?? '').trim();
      if (current === imported) continue;
      fieldDiffs.push({ field, before: current, after: imported });
    }
    rows.push({
      nationalId: nid,
      applicantId: matched.applicantId,
      fullName: matched.fullName,
      unmatched: false, fieldDiffs, writeback, errors,
    });
  }

  return {
    counts: {
      total: rows.length,
      matched: rows.filter((r) => !r.unmatched).length,
      unmatched: rows.filter((r) => r.unmatched).length,
      withDiff: rows.filter((r) => r.fieldDiffs.length > 0).length,
      withWriteback: rows.filter((r) => r.writeback?.outcome != null).length,
      invalid: rows.filter((r) => r.errors.length > 0 && !r.errors.includes('APPLICANT_NID_UNMATCHED')).length,
    },
    rows,
  };
}

/** Mock reconciliation commit. Patches the in-memory mock applicants store so
 *  the same demo session reflects the writes on subsequent reads. Mirrors the
 *  backend's per-applicant partial-commit semantics. */
function mockReconcileCommit(
  request: ApplicantReconciliationCommitRequest,
): ApplicantReconciliationCommitResult {
  const preview = mockReconcilePreview(request.sheet);
  const previewByNid = new Map(preview.rows.map((r) => [r.nationalId, r]));
  const importByNid = new Map(request.sheet.rows.map((r) => [r.nationalId ?? r.business_key ?? '', r]));
  const store = seededStore('Applicants');
  let attempted = 0;
  let successCount = 0;
  let fieldsWritten = 0;
  let writebacksApplied = 0;
  const failedRows: ApplicantReconciliationCommitResult['failedRows'] = [];

  request.decisions.forEach((decision, idx) => {
    attempted += 1;
    const diff = previewByNid.get(decision.nationalId);
    if (!diff || diff.unmatched) {
      failedRows.push({ rowIndex: idx, sheetName: 'Applicants', errors: ['APPLICANT_NID_UNMATCHED'] });
      return;
    }
    const importRow = importByNid.get(decision.nationalId);
    if (!importRow) {
      failedRows.push({ rowIndex: idx, sheetName: 'Applicants', errors: ['IMPORT_ROW_MISSING'] });
      return;
    }
    const dbRow = store.find((r) => (r.cells.nationalId ?? r.businessKey) === decision.nationalId);
    if (!dbRow) {
      failedRows.push({ rowIndex: idx, sheetName: 'Applicants', errors: ['APPLICANT_NID_UNMATCHED'] });
      return;
    }
    let fieldsWrittenThis = 0;
    for (const diffEntry of diff.fieldDiffs) {
      if (!decision.acceptedFields.includes(diffEntry.field)) continue;
      const newValue = importRow[diffEntry.field];
      if (newValue == null) continue;
      dbRow.cells[diffEntry.field] = newValue;
      fieldsWrittenThis += 1;
    }
    let writebackApplied = false;
    if (
      decision.applyWriteback &&
      diff.writeback?.outcome &&
      !diff.writeback.errors.includes('RESULT_VALUE_UNKNOWN')
    ) {
      const testCode = diff.writeback.testCode ?? 'TST-01';
      dbRow.cells[`followUp.${testCode}`] = diff.writeback.outcome;
      if (diff.writeback.outcome === 'passed' && diff.writeback.nextExamDate) {
        dbRow.cells['examSlot.date'] = diff.writeback.nextExamDate;
      }
      writebackApplied = true;
    }
    if (fieldsWrittenThis > 0 || writebackApplied) {
      successCount += 1;
      fieldsWritten += fieldsWrittenThis;
      if (writebackApplied) writebacksApplied += 1;
    }
  });

  return {
    attemptedCount: attempted,
    successCount,
    fieldsWrittenCount: fieldsWritten,
    writebacksAppliedCount: writebacksApplied,
    failedCount: failedRows.length,
    failedRows,
  };
}

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
      cells['examSlot.time'] = i === 0 ? '08:00' : '10:00';
      cells.committeeName = i === 0 ? 'اللجنة الأولى قسم عام' : 'اللجنة الأولى ليسانس حقوق (طالبات)';
      cells['examSlot.location'] = 'كلية الشرطة - مبنى الاختبارات - القاهرة';
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

async function mockExport({ domains, layout, filter, nationalIds }: ExportParams): Promise<ExportResult> {
  const sheets: ExportSheet[] = [];
  let total = 0;
  const allow = nationalIds && nationalIds.length > 0 ? new Set(nationalIds) : null;
  for (const domain of domains) {
    let rows = seededStore(domain);
    // Applicants are only exported once the first exam appointment is booked.
    // Mirrors the backend `IsApplicantBooked` gate so the mock path matches.
    if (domain === 'Applicants') rows = rows.filter((r) => isApplicantBooked(r.cells));
    if (filter === 'modifiedSinceCreation') rows = rows.filter((r) => r.updatedAt !== r.createdAt);
    else if (typeof filter === 'object' && 'changedAfter' in filter) {
      rows = rows.filter((r) => r.updatedAt >= filter.changedAfter);
    }
    // Per-row admin selection (national-id allow-list) — Applicants only.
    if (allow && domain === 'Applicants') {
      rows = rows.filter((r) => allow.has(r.businessKey));
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
