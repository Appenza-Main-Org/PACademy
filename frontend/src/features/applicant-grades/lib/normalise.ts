/**
 * Convert a `ParsedTable`'s rows (keyed by source-column name) into the
 * `NormalisedRow[]` shape Step 4's filters + Step 5's preflight expect,
 * applying the wizard's column mapping and value filters.
 *
 * Eastern-Arabic digits are normalised to ASCII so a column like
 * "الرقم القومي" containing ٣٠٤١٢١٨٠١٠٣٤٥٦ round-trips through downstream
 * code that expects ASCII digit strings.
 */

import type { ParsedTable } from './parseGradesFile';
import type { TargetField } from './targetFields';
import type { NormalisedRow } from '../types';
import type { FilterState, LookupValueMappings } from '../store/importWizard.store';

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function easternToAscii(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    const idx = EASTERN_DIGITS.indexOf(ch);
    if (idx >= 0) {
      out += String(idx);
    } else {
      out += ch;
    }
  }
  return out;
}

function asString(v: string | number | null): string | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  const t = v.trim();
  return t === '' ? null : t;
}

function asDigitString(v: string | number | null): string | null {
  const s = asString(v);
  if (s == null) return null;
  /* Strip every non-digit so spaces / dashes / Eastern digits all
   * collapse to the canonical ASCII representation. */
  return easternToAscii(s).replace(/\D/g, '') || null;
}

function asNumber(v: string | number | null): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = easternToAscii(v.trim().replace(/[,٬]/g, ''));
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function rowMatchesFilters(
  rawRow: Record<string, string | number | null>,
  filters: Record<string, FilterState>,
): boolean {
  for (const [col, state] of Object.entries(filters)) {
    if (state.mode === 'all') continue;
    const cell = rawRow[col];
    const stringified = cell == null ? '' : String(cell);
    if (!state.values.includes(stringified)) return false;
  }
  return true;
}

export function normaliseRows(
  table: ParsedTable,
  mapping: Record<TargetField, string | null>,
  filters: Record<string, FilterState>,
  graduationYear: number,
  lookupValueMappings?: LookupValueMappings,
): NormalisedRow[] {
  const out: NormalisedRow[] = [];
  table.rows.forEach((raw, i) => {
    if (!rowMatchesFilters(raw, filters)) return;
    const get = (key: TargetField): string | number | null => {
      const src = mapping[key];
      return src ? raw[src] ?? null : null;
    };
    const rawSchoolCategory = asString(get('schoolCategory'));
    const rawExamRound = asString(get('examRound'));
    out.push({
      nationalId: asDigitString(get('nationalId')),
      seatingNumber: asString(get('seatingNumber')),
      nameAr: asString(get('nameAr')),
      gender: asString(get('gender')),
      track: asString(get('track')),
      graduationYear: asNumber(get('graduationYear')) ?? graduationYear,
      totalGrade: asNumber(get('totalGrade')),
      maxGrade: asNumber(get('maxGrade')),
      schoolCategory:
        rawSchoolCategory == null
          ? null
          : lookupValueMappings?.schoolCategory[rawSchoolCategory] ?? rawSchoolCategory,
      examRound:
        rawExamRound == null
          ? null
          : lookupValueMappings?.examRound[rawExamRound] ?? rawExamRound,
      schoolName: asString(get('schoolName')),
      regionName: asString(get('regionName')),
      sourceRowIndex: i + 1,
    });
  });
  return out;
}

/** Count rows that would survive the active filter set. */
export function countFiltered(
  table: ParsedTable,
  filters: Record<string, FilterState>,
): number {
  let n = 0;
  for (const row of table.rows) {
    if (rowMatchesFilters(row, filters)) n += 1;
  }
  return n;
}

/** Distinct values + their occurrence counts for `column` in `table`. */
export function distinctValues(
  table: ParsedTable,
  column: string,
): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of table.rows) {
    const cell = row[column];
    const v = cell == null ? '' : String(cell);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}
