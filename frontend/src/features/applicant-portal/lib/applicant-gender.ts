import { parseNationalId } from '@/shared/lib/national-id';

export type ApplicantGender = 'male' | 'female';

const FEMALE_VALUES = new Set(['female', 'f', 'أنثى', 'انثى', 'أنثي', 'انثي']);
const MALE_VALUES = new Set(['male', 'm', 'ذكر']);

export function normalizeApplicantGender(value: unknown, nationalId: string): ApplicantGender {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (FEMALE_VALUES.has(normalized)) return 'female';
    if (MALE_VALUES.has(normalized)) return 'male';
  }

  return parseNationalId(nationalId).gender ?? 'male';
}
