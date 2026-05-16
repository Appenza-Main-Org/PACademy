/**
 * MOI session mock — applicant-flow MOI-alignment.
 *
 * The reference flow document (`docs/references/applicant-flow-moi-portal.pdf`)
 * shows the applicant arriving from moi.gov.eg with a fully-populated identity
 * session: full name, NID, DOB, gender, mobile, email. Our `/applicant`
 * surface begins post-MOI-login; we never rebuild that handoff. This module
 * is the deterministic stand-in for the session payload until the real MOI
 * SSO link lands in production.
 *
 * Values are static (no rng()) so the same render always shows the same
 * applicant — matching the seed=42 determinism guarantee in
 * `shared/mock-data/seed.ts`. The applicant id is the same APP-2026000
 * used across the wizard mocks.
 */

import { parseNationalId } from '@/shared/lib/national-id';

export interface MoiApplicantSession {
  applicantId: string;
  fullName: string;
  nationalId: string;
  /** ISO yyyy-mm-dd, derived from NID. */
  dateOfBirth: string;
  /** Arabic short-date for display. */
  dateOfBirthAr: string;
  gender: 'male' | 'female';
  mobile: string;
  email: string;
  birthGovernorate: string;
  birthDistrict: string;
  religion: 'مسلم' | 'مسيحي';
}

/* NID: 14 digits. Layout (matches `parseNationalId`):
 *   2 (century: 3=20s)  ·  YYMMDD  ·  2 (governorate)  ·  4 (sequence)
 *   ·  1 (gender check) ·  1 (checksum)
 *
 * 30506121601234 → century 3 (2050? actually 3 = 19xx, so 1995-06-12), gov 16,
 * gender digit 3 (odd → male). Matches the printed reference card.
 */
const NID = '30506121601234';

function fmtArabic(date: Date): string {
  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const parsed = parseNationalId(NID);
const dob = parsed.birthDate ?? new Date('1995-06-12');
const dobIso = `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;
const gender: 'male' | 'female' = parsed.gender ?? 'male';

export const MOI_APPLICANT_SESSION: MoiApplicantSession = {
  applicantId: 'APP-2026000',
  fullName: 'يوسف أحمد محمد الخطيب',
  nationalId: NID,
  dateOfBirth: dobIso,
  dateOfBirthAr: fmtArabic(dob),
  gender,
  mobile: '01012345678',
  email: 'youssef.alkhatib@gmail.com',
  birthGovernorate: 'القاهرة',
  birthDistrict: 'مدينة نصر',
  religion: 'مسلم',
};

/** Verify a re-entered NID + mobile match the MOI session payload.
 *  Used by `/applicant/verify` (PDF p.5 lower). */
export function moiSessionMatches(input: {
  nationalId: string;
  mobile: string;
}): boolean {
  return (
    input.nationalId.trim() === MOI_APPLICANT_SESSION.nationalId &&
    input.mobile.trim() === MOI_APPLICANT_SESSION.mobile
  );
}
