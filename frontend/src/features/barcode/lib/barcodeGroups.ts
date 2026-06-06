/**
 * Group-print dimensions (US-BC-003) — the four filters an operator can
 * combine to select a batch of applicants for bulk card printing:
 * Category · Exam Type · Committee · Qualification.
 *
 * The option lists are config-driven (this module is their single source —
 * the page never inlines them). Committee + qualification resolve from real
 * applicant fields; category + exam-type are not stored on the seeded
 * applicant pool, so they are assigned deterministically per applicant id
 * (stable FNV-1a hash — no global LCG mutation) so the filters actually
 * narrow the mock data. Labels are copied verbatim from the lookups seed
 * (applicant-categories) and the domain TEST_KIND_LABELS.
 *
 * INTEGRATION NOTE: on the on-prem backend these resolve from the cycle's
 * configured categories / exam plan and the applicant's real committee +
 * qualification — drop the deterministic assignment then.
 */

import { COMMITTEES_NAMES, CERTIFICATES } from '@/shared/mock-data/dictionaries';
import type { Applicant } from '@/shared/types/domain';

export interface GroupOption {
  value: string;
  label: string;
}

export type GroupDimensionKey = 'category' | 'examType' | 'committee' | 'qualification';

/** A combined selection; an unset (empty) dimension means "all". */
export interface GroupSelection {
  category: string;
  examType: string;
  committee: string;
  qualification: string;
}

export const EMPTY_GROUP_SELECTION: GroupSelection = {
  category: '',
  examType: '',
  committee: '',
  qualification: '',
};

/** RFP applicant-categories (labels verbatim from the lookups seed). */
export const BARCODE_CATEGORY_OPTIONS: readonly GroupOption[] = [
  { value: 'officers_general', label: 'قسم الضباط (قسم عام)' },
  { value: 'law_bachelor', label: 'ليسانس حقوق' },
  { value: 'physical_education_bachelor', label: 'بكالوريوس تربية رياضية' },
  { value: 'specialized_officers', label: 'الضباط المتخصصون' },
];

/** Exam types (labels verbatim from domain TEST_KIND_LABELS). */
export const BARCODE_EXAM_TYPE_OPTIONS: readonly GroupOption[] = [
  { value: 'medical', label: 'طبي' },
  { value: 'physical', label: 'بدني' },
  { value: 'written', label: 'تحريري' },
  { value: 'interview', label: 'مقابلة شخصية' },
];

/** Committee options mirror the seeded applicant.committee ordinal names. */
export const BARCODE_COMMITTEE_OPTIONS: readonly GroupOption[] = COMMITTEES_NAMES.map((c) => ({
  value: c,
  label: `اللجنة ${c}`,
}));

/** Qualification options = distinct certificate types in the pool. */
export const BARCODE_QUALIFICATION_OPTIONS: readonly GroupOption[] = Array.from(
  new Set(CERTIFICATES.map((c) => c.type)),
).map((t) => ({ value: t, label: t }));

/** FNV-1a 32-bit hash — stable, fast, no global LCG mutation. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministically pick one option value for an applicant id. */
function pickFor(id: string, salt: string, options: readonly GroupOption[]): string {
  if (options.length === 0) return '';
  const idx = fnv1a(`${id}|${salt}`) % options.length;
  return options[idx]!.value;
}

/** Resolve every group dimension's value for one applicant. */
export function resolveGroupValues(applicant: Applicant): GroupSelection {
  return {
    category: pickFor(applicant.id, 'category', BARCODE_CATEGORY_OPTIONS),
    examType: pickFor(applicant.id, 'examType', BARCODE_EXAM_TYPE_OPTIONS),
    committee: applicant.committee,
    qualification: applicant.certType,
  };
}

const LABEL_BY_VALUE = (options: readonly GroupOption[]): Map<string, string> =>
  new Map(options.map((o) => [o.value, o.label]));

const CATEGORY_LABELS = LABEL_BY_VALUE(BARCODE_CATEGORY_OPTIONS);
const EXAM_TYPE_LABELS = LABEL_BY_VALUE(BARCODE_EXAM_TYPE_OPTIONS);

export function categoryLabel(value: string): string {
  return CATEGORY_LABELS.get(value) ?? value;
}
export function examTypeLabel(value: string): string {
  return EXAM_TYPE_LABELS.get(value) ?? value;
}

/** Does an applicant satisfy a (partial) group selection? Each set
 *  dimension must match exactly; empty dimensions are wildcards. */
export function matchesGroupSelection(applicant: Applicant, selection: GroupSelection): boolean {
  const resolved = resolveGroupValues(applicant);
  if (selection.category && resolved.category !== selection.category) return false;
  if (selection.examType && resolved.examType !== selection.examType) return false;
  if (selection.committee && resolved.committee !== selection.committee) return false;
  if (selection.qualification && resolved.qualification !== selection.qualification) return false;
  return true;
}

/** Deterministic batch card code (matches the legacy batch format). */
export function batchCardCode(applicant: Applicant): string {
  return `26-CAI-${applicant.id.replace('APP-', '').padStart(8, '0')}`;
}
