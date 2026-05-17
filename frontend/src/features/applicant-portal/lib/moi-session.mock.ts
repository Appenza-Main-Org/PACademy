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

/** Verify a re-entered NID + mobile match the MOI session payload. */
export function moiSessionMatches(input: {
  nationalId: string;
  mobile: string;
}): boolean {
  return (
    input.nationalId.trim() === MOI_APPLICANT_SESSION.nationalId &&
    input.mobile.trim() === MOI_APPLICANT_SESSION.mobile
  );
}

/**
 * Mock the MOI portal identity-verification call. Returns the
 * deterministic session payload for the seeded NID; otherwise derives a
 * plausible mock response from the NID itself (DOB from the 14-digit
 * format, gender from the sequence digit, governorate label from the
 * GG slice, name + mobile from a small DJB2-ish hash).
 *
 * INTEGRATION CONTRACT (real implementation lives on MOI side):
 *   POST https://moi.gov.eg/api/national-id/verify
 *   body: { nid }
 *   200 → MoiApplicantSession-shaped payload
 *   404 → null
 */
export function mockMoiVerifyNid(nid: string): MoiApplicantSession | null {
  if (nid === MOI_APPLICANT_SESSION.nationalId) return MOI_APPLICANT_SESSION;
  const parsed = parseNidStructure(nid);
  if (!parsed) return null;
  const hash = djb2(nid);
  const namePool = [
    'محمد إبراهيم سعد',
    'يوسف أحمد محمد',
    'علي حسن طه',
    'عمر مصطفى الشيخ',
    'كريم مجدي عبد الله',
    'محمود فؤاد العقاد',
  ];
  const givenName = namePool[hash % namePool.length] ?? namePool[0]!;
  return {
    applicantId: 'APP-MOI-MOCK',
    fullName: givenName,
    nationalId: nid,
    dateOfBirth: parsed.dobIso,
    dateOfBirthAr: formatArabicDate(parsed.dob),
    gender: parsed.gender,
    mobile: `0101${String((hash >>> 0) % 10_000_000).padStart(7, '0')}`,
    email: `applicant.${nid.slice(-4)}@example.eg`,
    birthGovernorate: governorateFromCode(parsed.gov),
    birthDistrict: 'مركز التقدم',
    religion: 'مسلم',
  };
}

interface ParsedNid {
  dob: Date;
  dobIso: string;
  gender: 'male' | 'female';
  gov: string;
}

function parseNidStructure(nid: string): ParsedNid | null {
  if (!/^\d{14}$/.test(nid)) return null;
  const century = nid[0] === '2' ? 1900 : 2000;
  const yy = Number(nid.slice(1, 3));
  const mm = Number(nid.slice(3, 5));
  const dd = Number(nid.slice(5, 7));
  const gov = nid.slice(7, 9);
  const sequence = nid.slice(9, 13);
  const last = Number(sequence[sequence.length - 1]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const dob = new Date(century + yy, mm - 1, dd);
  if (Number.isNaN(dob.getTime())) return null;
  return {
    dob,
    dobIso: `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`,
    gender: last % 2 === 0 ? 'female' : 'male',
    gov,
  };
}

function formatArabicDate(date: Date): string {
  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const GOV_MAP: Record<string, string> = {
  '01': 'القاهرة',
  '02': 'الإسكندرية',
  '03': 'بورسعيد',
  '04': 'السويس',
  '11': 'دمياط',
  '12': 'الدقهلية',
  '13': 'الشرقية',
  '14': 'القليوبية',
  '15': 'كفر الشيخ',
  '16': 'الغربية',
  '17': 'المنوفية',
  '18': 'البحيرة',
  '19': 'الإسماعيلية',
  '21': 'الجيزة',
  '22': 'بني سويف',
  '23': 'الفيوم',
  '24': 'المنيا',
  '25': 'أسيوط',
  '26': 'سوهاج',
  '27': 'قنا',
  '28': 'أسوان',
  '29': 'الأقصر',
  '31': 'البحر الأحمر',
  '32': 'الوادي الجديد',
  '33': 'مرسى مطروح',
  '34': 'شمال سيناء',
  '35': 'جنوب سيناء',
  '88': 'خارج الجمهورية',
};

function governorateFromCode(gg: string): string {
  return GOV_MAP[gg] ?? 'غير محددة';
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33 + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}
