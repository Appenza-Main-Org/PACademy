import type { ApplicantGender, GradeKind, GradeRow } from '@/features/applicant-grades/types';

type GradePayload = Record<string, unknown>;

export interface EligibilityGradeExtras {
  country: string;
  gradDate: string;
}

function stringValue(payload: GradePayload, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function numberValue(payload: GradePayload, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeKind(value: string | null): GradeKind {
  if (!value) return 'general';
  const normalized = value.toLowerCase();
  return normalized.includes('azhar') || value.includes('أزهر') ? 'azhar' : 'general';
}

function normalizeGender(value: string | null): ApplicantGender {
  if (!value) return 'male';
  const normalized = value.toLowerCase();
  return normalized.includes('female') || value.includes('أنث') ? 'female' : 'male';
}

export function normalizeThanawiBranch(value: string | null): string {
  if (!value) return '';
  const text = value.trim();
  if (text.includes('رياض')) return 'علمي رياضة';
  if (text.includes('علوم')) return 'علمي علوم';
  if (text.includes('أدب') || text.includes('ادب')) return 'أدبي';
  if (text === 'علمي' || text.includes('علمي')) return 'علمي';
  return text;
}

export function mapEligibilityGradeToGradeRow(grade: GradePayload | null | undefined): GradeRow | null {
  if (!grade) return null;

  const nid = stringValue(grade, ['nid', 'nationalId']);
  const total = numberValue(grade, ['total', 'totalGrade', 'effectiveTotal']);
  const importMax = numberValue(grade, ['importMax', 'maxGrade', 'max']);
  if (!nid || total === null || importMax === null || importMax <= 0) return null;

  const seat = numberValue(grade, ['seat']) ?? 0;
  return {
    id: stringValue(grade, ['id']) ?? undefined,
    seat,
    seatingNumber: stringValue(grade, ['seatingNumber', 'seatNumber']) ?? (seat > 0 ? String(seat) : null),
    nid,
    name: stringValue(grade, ['name', 'nameAr', 'fullName']) ?? '',
    kind: normalizeKind(stringValue(grade, ['kind', 'certificateKind'])),
    gender: normalizeGender(stringValue(grade, ['gender'])),
    branch: normalizeThanawiBranch(stringValue(grade, ['branch', 'track'])),
    graduationYear: numberValue(grade, ['graduationYear', 'year']),
    schoolCategoryCode: stringValue(grade, ['schoolCategoryCode', 'schoolCategory']),
    school: stringValue(grade, ['school', 'schoolName', 'schoolNameAr']) ?? '',
    region: stringValue(grade, ['region', 'regionName', 'schoolAddress']) ?? '',
    examRound: stringValue(grade, ['examRound']),
    total,
    importMax,
    overrideMax: numberValue(grade, ['overrideMax']),
    lastEditedAt: stringValue(grade, ['lastEditedAt']),
    lastEditedBy: stringValue(grade, ['lastEditedBy']),
    createdAt: stringValue(grade, ['createdAt']),
    updatedAt: stringValue(grade, ['updatedAt']),
    gradeChangedAt: stringValue(grade, ['gradeChangedAt']),
    previousGrade: numberValue(grade, ['previousGrade']),
    status: stringValue(grade, ['status']) ?? '—',
    log: [],
  };
}

export function getEligibilityGradeExtras(grade: GradePayload | null | undefined): EligibilityGradeExtras | null {
  if (!grade) return null;
  return {
    country: stringValue(grade, ['country', 'schoolCountry']) ?? 'مصر',
    gradDate: stringValue(grade, ['graduationDate', 'certificateDate']) ?? '',
  };
}
