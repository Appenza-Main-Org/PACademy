/**
 * Bulk question import — parsing, validation, and template generation.
 *
 * Accepts the 5 seeded categories. Errors block the row from import;
 * warnings are non-blocking. Output rows that pass validation are
 * shaped as `QuestionDraft` for `examsService.createQuestionBatch`.
 */

import * as XLSX from 'xlsx';
import type { QuestionDraft } from '@/shared/types/domain';

export const ALLOWED_CATEGORIES = [
  'قدرات لفظية',
  'قدرات عددية',
  'منطق',
  'سرعة بديهة',
  'ثقافة عامة',
] as const;

export const MAX_IMPORT_ROWS = 1000;

export const TEMPLATE_HEADERS = [
  'الفئة',
  'الصعوبة',
  'نص السؤال',
  'الإجابة 1',
  'الإجابة 2',
  'الإجابة 3',
  'الإجابة 4',
  'الإجابة الصحيحة',
  'شرح الإجابة',
] as const;

export type ImportSeverity = 'valid' | 'warning' | 'error';

export interface ImportRow {
  /** 1-based row number as it appears in the source file (skipping the header row). */
  rowNumber: number;
  category: string;
  difficulty: number | null;
  text: string;
  options: string[];
  correctIndex: number | null;
  explanation: string;
  severity: ImportSeverity;
  errors: string[];
  warnings: string[];
}

export interface ImportSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  perCategory: Record<string, number>;
}

const EXAMPLE_ROW = [
  'قدرات لفظية',
  3,
  'ما الكلمة المرادفة لـ "شجاع"؟',
  'جبان',
  'مقدام',
  'كسول',
  'هادئ',
  2,
  'مقدام تعني صاحب جرأة وشجاعة.',
];

/** Build a single-sheet XLSX workbook with one example row. */
export function buildTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS], EXAMPLE_ROW]);
  /* RTL view + sensible column widths so it opens cleanly in Excel-AR. */
  ws['!cols'] = [
    { wch: 14 }, { wch: 9 }, { wch: 48 },
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 14 }, { wch: 36 },
  ];
  ws['!view' as keyof typeof ws] = { RTL: true } as never;
  XLSX.utils.book_append_sheet(wb, ws, 'الأسئلة');
  return wb;
}

export function downloadTemplate(filename = 'question-bank-template.xlsx'): void {
  if (typeof document === 'undefined') return;
  const wb = buildTemplateWorkbook();
  XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
}

/** Parse an uploaded file (xlsx/xls/csv) into raw row objects. */
export async function parseImportFile(file: File): Promise<unknown[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' });
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function asInt(v: unknown): number | null {
  const s = asString(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Validate a single parsed row. Returns a structured `ImportRow`. */
export function validateRow(raw: unknown[], rowNumber: number): ImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const category = asString(raw[0]);
  const difficulty = asInt(raw[1]);
  const text = asString(raw[2]);
  const options = [asString(raw[3]), asString(raw[4]), asString(raw[5]), asString(raw[6])];
  const correctIndex1Based = asInt(raw[7]);
  const explanation = asString(raw[8]);

  if (!category) {
    errors.push('الفئة مطلوبة');
  } else if (!ALLOWED_CATEGORIES.includes(category as (typeof ALLOWED_CATEGORIES)[number])) {
    errors.push(`الفئة "${category}" غير معروفة`);
  }

  if (difficulty === null) {
    errors.push('الصعوبة مطلوبة');
  } else if (difficulty < 1 || difficulty > 5) {
    errors.push('الصعوبة خارج المدى المسموح (1–5)');
  }

  if (!text) {
    errors.push('نص السؤال فارغ');
  } else if (text.length > 500) {
    errors.push(`نص السؤال يتجاوز 500 حرف (${text.length})`);
  } else if (text.length < 8) {
    warnings.push('نص السؤال قصير جداً');
  }

  for (let i = 0; i < 4; i += 1) {
    const opt = options[i] ?? '';
    if (!opt) {
      errors.push(`الإجابة ${i + 1} فارغة`);
    } else if (opt.length > 200) {
      errors.push(`الإجابة ${i + 1} تتجاوز 200 حرف`);
    }
  }

  if (correctIndex1Based === null) {
    errors.push('رقم الإجابة الصحيحة مطلوب');
  } else if (correctIndex1Based < 1 || correctIndex1Based > 4) {
    errors.push('رقم الإجابة الصحيحة يجب أن يكون بين 1 و 4');
  }

  /* De-dup detection on options as a soft warning. */
  const uniq = new Set(options.map((o) => o.trim()).filter(Boolean));
  if (uniq.size > 0 && uniq.size < options.filter(Boolean).length) {
    warnings.push('بعض الخيارات مكررة');
  }

  let severity: ImportSeverity = 'valid';
  if (errors.length > 0) severity = 'error';
  else if (warnings.length > 0) severity = 'warning';

  return {
    rowNumber,
    category,
    difficulty,
    text,
    options,
    correctIndex: correctIndex1Based === null ? null : correctIndex1Based - 1,
    explanation,
    severity,
    errors,
    warnings,
  };
}

/** Validate the full sheet. The first non-empty row is treated as the header. */
export function validateSheet(matrix: unknown[][]): ImportRow[] {
  if (matrix.length === 0) return [];
  /* Drop header if it matches the template; otherwise keep all rows. */
  const first = (matrix[0] ?? []).map(asString);
  const looksLikeHeader = first[0] === TEMPLATE_HEADERS[0] || first[2] === TEMPLATE_HEADERS[2];
  const dataRows = looksLikeHeader ? matrix.slice(1) : matrix;
  const rows: ImportRow[] = [];
  for (let i = 0; i < dataRows.length; i += 1) {
    const raw = dataRows[i] ?? [];
    /* Skip wholly-empty rows quietly. */
    const isEmpty = raw.every((cell) => asString(cell) === '');
    if (isEmpty) continue;
    rows.push(validateRow(raw, i + (looksLikeHeader ? 2 : 1)));
    if (rows.length >= MAX_IMPORT_ROWS) break;
  }
  return rows;
}

export function summarize(rows: readonly ImportRow[]): ImportSummary {
  const perCategory: Record<string, number> = {};
  let valid = 0;
  let warnings = 0;
  let errors = 0;
  for (const r of rows) {
    if (r.severity === 'error') errors += 1;
    else if (r.severity === 'warning') {
      warnings += 1;
      valid += 1; // warnings still importable
      perCategory[r.category] = (perCategory[r.category] ?? 0) + 1;
    } else {
      valid += 1;
      perCategory[r.category] = (perCategory[r.category] ?? 0) + 1;
    }
  }
  return { total: rows.length, valid, warnings, errors, perCategory };
}

/** Convert validated rows (warnings + valid) into ready-to-submit drafts. */
export function rowsToDrafts(rows: readonly ImportRow[]): QuestionDraft[] {
  const drafts: QuestionDraft[] = [];
  for (const r of rows) {
    if (r.severity === 'error') continue;
    if (r.difficulty === null || r.correctIndex === null) continue;
    drafts.push({
      category: r.category,
      difficulty: Math.min(5, Math.max(1, r.difficulty)) as 1 | 2 | 3 | 4 | 5,
      type: 'mcq',
      text: r.text,
      options: r.options,
      correctIndex: r.correctIndex,
      timeLimitSeconds: 60,
      notes: r.explanation || undefined,
    });
  }
  return drafts;
}

/** CSV report describing every row's validation outcome. UTF-8 with BOM
 *  so Excel-AR opens it correctly. */
export function buildValidationCsv(rows: readonly ImportRow[]): string {
  const header = ['#', 'الحالة', 'الفئة', 'الصعوبة', 'نص السؤال', 'الأخطاء', 'تحذيرات'];
  const escape = (s: string): string => '"' + s.replace(/"/g, '""') + '"';
  const lines = [header.map(escape).join(',')];
  const statusLabel: Record<ImportSeverity, string> = {
    valid: 'صالح',
    warning: 'تحذير',
    error: 'خطأ',
  };
  for (const r of rows) {
    lines.push([
      String(r.rowNumber),
      statusLabel[r.severity],
      r.category,
      r.difficulty === null ? '' : String(r.difficulty),
      r.text,
      r.errors.join(' · '),
      r.warnings.join(' · '),
    ].map(escape).join(','));
  }
  return '﻿' + lines.join('\n');
}
