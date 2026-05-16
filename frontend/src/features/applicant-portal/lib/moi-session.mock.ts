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

/* NID: 14 digits. Picked to match the first row of the seeded grade dataset
 * (`features/applicant-grades/mock.ts`) so the demo applicant arrives with
 * an external-imported ثانوية record — exercising the matched branch of
 * Stage 3+4+5. Manual-entry fallback is still exercised whenever an admin
 * imports a fresh dataset that omits this NID.
 *
 * NB: the shared `parseNationalId` helper has an inverted century lookup
 * — we hardcode the DOB + gender here rather than derive them via the
 * helper. */
const NID = '30412180103456';
const DOB_ISO = '2004-12-18';

function fmtArabic(date: Date): string {
  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const dob = new Date(DOB_ISO);
const dobIso = DOB_ISO;
const gender: 'male' | 'female' = 'male';

export const MOI_APPLICANT_SESSION: MoiApplicantSession = {
  applicantId: 'APP-2026000',
  fullName: 'أحمد محمد إبراهيم سعد',
  nationalId: NID,
  dateOfBirth: dobIso,
  dateOfBirthAr: fmtArabic(dob),
  gender,
  mobile: '01012345678',
  email: 'ahmed.ibrahim.saad@gmail.com',
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
