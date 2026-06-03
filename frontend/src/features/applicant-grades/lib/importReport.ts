import type {
  ImportFailureRow,
  ImportGroupAction,
  ImportGroupCode,
  ImportReport,
  ImportReportGroup,
} from '../types';

const IMPORT_GROUP_CODES = new Set<ImportGroupCode>([
  'DUPLICATE_NID',
  'INVALID_NID',
  'GENDER_MISMATCH',
  'AGE_OUT_OF_RANGE',
  'MISSING_REQUIRED',
  'NID_NOT_FOUND',
  'GRADE_OUT_OF_RANGE',
  'UNREADABLE_VALUE',
]);

const IMPORT_GROUP_ACTIONS = new Set<ImportGroupAction>([
  'skip',
  'override',
  'export',
  'create-applicant',
]);

const GROUP_LABELS: Record<ImportGroupCode, string> = {
  DUPLICATE_NID: 'أرقام قومية مكررة',
  INVALID_NID: 'أرقام قومية غير صالحة',
  GENDER_MISMATCH: 'نوع لا يطابق الرقم القومي',
  AGE_OUT_OF_RANGE: 'سن خارج الإعدادات',
  MISSING_REQUIRED: 'بيانات إلزامية ناقصة',
  NID_NOT_FOUND: 'أرقام غير موجودة',
  GRADE_OUT_OF_RANGE: 'درجات خارج النطاق',
  UNREADABLE_VALUE: 'قيم غير قابلة للقراءة',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringProp(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

function numberProp(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function arrayProp(record: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function isGroupCode(value: string | null): value is ImportGroupCode {
  return value != null && IMPORT_GROUP_CODES.has(value as ImportGroupCode);
}

function normalizeActions(value: unknown, code: ImportGroupCode): ImportGroupAction[] {
  const actions = Array.isArray(value)
    ? value.filter((item): item is ImportGroupAction =>
        typeof item === 'string' && IMPORT_GROUP_ACTIONS.has(item as ImportGroupAction),
      )
    : [];

  if (actions.length > 0) return actions;
  return code === 'GRADE_OUT_OF_RANGE' ? ['skip', 'override', 'export'] : ['skip', 'export'];
}

function normalizeRow(value: unknown): ImportFailureRow {
  const row = isRecord(value) ? value : {};
  return {
    nationalId: stringProp(row, 'nationalId', 'NationalId'),
    seatingNumber: stringProp(row, 'seatingNumber', 'SeatingNumber'),
    nameAr: stringProp(row, 'nameAr', 'name', 'NameAr', 'Name'),
    totalGrade: numberProp(row, 'totalGrade', 'TotalGrade'),
    sourceRowIndex: numberProp(row, 'sourceRowIndex', 'rowIndex', 'SourceRowIndex', 'RowIndex') ?? 0,
    detail: stringProp(row, 'detail', 'message', 'Detail', 'Message') ?? undefined,
  };
}

function normalizeGroup(value: unknown): ImportReportGroup | null {
  if (!isRecord(value)) return null;

  const rawCode = stringProp(value, 'code', 'Code');
  if (!isGroupCode(rawCode)) return null;

  const labelAr = stringProp(value, 'labelAr', 'label', 'LabelAr', 'Label') ?? GROUP_LABELS[rawCode];
  const actionsValue = value.availableActions ?? value.actions ?? value.AvailableActions ?? value.Actions;

  return {
    code: rawCode,
    labelAr,
    rows: arrayProp(value, 'rows', 'Rows').map(normalizeRow),
    availableActions: normalizeActions(actionsValue, rawCode),
  };
}

export function normalizeImportReport(value: unknown): ImportReport {
  const report = isRecord(value) ? value : {};
  const totals = isRecord(report.totals)
    ? report.totals
    : isRecord(report.Totals)
      ? report.Totals
      : {};

  return {
    totals: {
      received: numberProp(totals, 'received', 'Received') ?? 0,
      imported: numberProp(totals, 'imported', 'Imported') ?? 0,
      skipped: numberProp(totals, 'skipped', 'Skipped') ?? 0,
      failed: numberProp(totals, 'failed', 'Failed') ?? 0,
    },
    groups: arrayProp(report, 'groups', 'Groups')
      .map(normalizeGroup)
      .filter((group): group is ImportReportGroup => group !== null),
  };
}
