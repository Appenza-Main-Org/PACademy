import type { AcademicDegreeRow, MaritalStatusRow } from '@/features/lookups';

export type MaritalStatusValue = 'single' | 'married' | 'divorced' | 'widowed';
export type AcademicDegreeValue = 'license' | 'bachelor' | 'master' | 'doctorate';

export interface ProfileSelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

interface CategoryAllowedProfileCodes {
  categoryId: string;
  allowedMaritalStatusCodes?: unknown;
  allowedAcademicDegreeCodes?: unknown;
}

export interface AllowedApplicantProfileCodes {
  maritalStatusCodes: string[];
  academicDegreeCodes: string[];
}

export const RELIGION_OPTIONS: readonly ProfileSelectOption<'مسلم' | 'مسيحي'>[] = [
  { value: 'مسلم', label: 'مسلم' },
  { value: 'مسيحي', label: 'مسيحي' },
];

const MARITAL_BY_CODE: Record<string, ProfileSelectOption<MaritalStatusValue>> = {
  'MAR-01': { value: 'single', label: 'أعزب' },
  'MAR-02': { value: 'married', label: 'متزوج' },
  'MAR-03': { value: 'divorced', label: 'مطلق' },
  'MAR-04': { value: 'widowed', label: 'أرمل' },
};

const MARITAL_BY_VALUE: Record<MaritalStatusValue, string> = {
  single: 'أعزب',
  married: 'متزوج',
  divorced: 'مطلق',
  widowed: 'أرمل',
};

const FALLBACK_MARITAL_STATUSES: readonly ProfileSelectOption<MaritalStatusValue>[] = [
  { value: 'single', label: 'أعزب' },
  { value: 'married', label: 'متزوج' },
  { value: 'divorced', label: 'مطلق' },
  { value: 'widowed', label: 'أرمل' },
];

const ACADEMIC_DEGREE_BY_CODE: Record<string, ProfileSelectOption<AcademicDegreeValue>> = {
  'DEG-01': { value: 'bachelor', label: 'بكالوريوس' },
  'DEG-02': { value: 'master', label: 'ماجستير' },
  'DEG-03': { value: 'doctorate', label: 'دكتوراه' },
};

const FALLBACK_ACADEMIC_DEGREES: readonly ProfileSelectOption<AcademicDegreeValue>[] = [
  { value: 'license', label: 'ليسانس' },
  { value: 'bachelor', label: 'بكالوريوس' },
  { value: 'master', label: 'ماجستير' },
  { value: 'doctorate', label: 'دكتوراه' },
];

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];
}

function uniqueByValue<TValue extends string>(
  options: readonly ProfileSelectOption<TValue>[],
): ProfileSelectOption<TValue>[] {
  const seen = new Set<string>();
  const out: ProfileSelectOption<TValue>[] = [];
  for (const option of options) {
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    out.push(option);
  }
  return out;
}

function maritalOptionFromRow(row: Pick<MaritalStatusRow, 'code' | 'name'>): ProfileSelectOption<MaritalStatusValue> | null {
  const byCode = MARITAL_BY_CODE[row.code];
  if (byCode) return { ...byCode, label: row.name };

  const match = Object.entries(MARITAL_BY_VALUE).find(([, label]) => label === row.name);
  return match ? { value: match[0] as MaritalStatusValue, label: row.name } : null;
}

function degreeOptionFromRow(row: Pick<AcademicDegreeRow, 'code' | 'name'>): ProfileSelectOption<AcademicDegreeValue> | null {
  const byCode = ACADEMIC_DEGREE_BY_CODE[row.code];
  if (byCode) return { ...byCode, label: row.name };
  if (row.name.includes('ليسانس')) return { value: 'license', label: row.name };
  if (row.name.includes('بكالوريوس')) return { value: 'bachelor', label: row.name };
  if (row.name.includes('ماجستير')) return { value: 'master', label: row.name };
  if (row.name.includes('دكتوراه')) return { value: 'doctorate', label: row.name };
  return null;
}

export function getAllowedApplicantProfileCodes(
  categories: readonly CategoryAllowedProfileCodes[] | undefined,
  selectedCategoryKey: string | null | undefined,
): AllowedApplicantProfileCodes {
  const selected = selectedCategoryKey
    ? categories?.find((category) => category.categoryId === selectedCategoryKey)
    : undefined;
  return {
    maritalStatusCodes: stringArray(selected?.allowedMaritalStatusCodes),
    academicDegreeCodes: stringArray(selected?.allowedAcademicDegreeCodes),
  };
}

export function buildAllowedMaritalStatusOptions(
  rows: readonly Pick<MaritalStatusRow, 'code' | 'name' | 'isActive'>[],
  allowedCodes: readonly string[],
): ProfileSelectOption<MaritalStatusValue>[] {
  if (allowedCodes.length === 0 && rows.length === 0) return [...FALLBACK_MARITAL_STATUSES];

  const allowed = new Set(allowedCodes);
  const source = rows.length > 0
    ? rows
        .filter((row) => row.isActive)
        .filter((row) => allowed.size === 0 || allowed.has(row.code))
        .map(maritalOptionFromRow)
        .filter((option): option is ProfileSelectOption<MaritalStatusValue> => option !== null)
    : allowedCodes
        .map((code) => MARITAL_BY_CODE[code])
        .filter((option): option is ProfileSelectOption<MaritalStatusValue> => option !== undefined);

  return uniqueByValue(source);
}

export function buildAllowedAcademicDegreeOptions(
  rows: readonly Pick<AcademicDegreeRow, 'code' | 'name' | 'isActive'>[],
  allowedCodes: readonly string[],
): ProfileSelectOption<AcademicDegreeValue>[] {
  if (allowedCodes.length === 0) return [...FALLBACK_ACADEMIC_DEGREES];

  const allowed = new Set(allowedCodes);
  const source = rows.length > 0
    ? rows
        .filter((row) => row.isActive)
        .filter((row) => allowed.size === 0 || allowed.has(row.code))
        .map(degreeOptionFromRow)
        .filter((option): option is ProfileSelectOption<AcademicDegreeValue> => option !== null)
    : allowedCodes
        .map((code) => ACADEMIC_DEGREE_BY_CODE[code])
        .filter((option): option is ProfileSelectOption<AcademicDegreeValue> => option !== undefined);

  return uniqueByValue(source);
}
