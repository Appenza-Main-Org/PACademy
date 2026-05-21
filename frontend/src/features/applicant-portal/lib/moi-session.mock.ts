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

/* ────────────────────────────────────────────────────────────────────
 * DEMO TEST USERS — three scenarios the client wants to demo.
 *
 * Login routing reads the discriminated `MoiLookupResult` to decide
 * where to send the applicant after they sign in:
 *   eligible    → /applicant/profile (category pre-selected, dimmed fields)
 *   not_found   → /applicant/start   (CategorySelectionPage)
 *   ineligible  → /applicant/ineligible (polite rejection)
 * ──────────────────────────────────────────────────────────────────── */

import type { ApplicantCategoryKey } from '@/shared/types/domain';

export type MoiLookupResult =
  | { kind: 'eligible'; session: MoiApplicantSession; categoryKey: ApplicantCategoryKey }
  | { kind: 'ineligible'; session: MoiApplicantSession; reasonAr: string }
  | { kind: 'not_found' };

/** A second seeded MOI session — older applicant whose data is found but
 *  who does not qualify for any open category (over the age cutoff). */
const KHALED_NID = '28503150103456';
const KHALED_DOB = new Date('1985-03-15');
const KHALED_SESSION: MoiApplicantSession = {
  applicantId: 'APP-2026-KH',
  fullName: 'خالد عبد الرحمن سامي مصطفى',
  nationalId: KHALED_NID,
  dateOfBirth: '1985-03-15',
  dateOfBirthAr: fmtArabic(KHALED_DOB),
  gender: 'male',
  mobile: '01098765432',
  email: 'khaled.samy@gmail.com',
  birthGovernorate: 'الإسكندرية',
  birthDistrict: 'سيدي جابر',
  religion: 'مسلم',
};

/** Third test NID — MOI cannot find this applicant, simulating someone
 *  whose identity record isn't in the ministry database. */
const MOHAMED_UNKNOWN_NID = '30506200103456';

/** Fourth test NID — eligible applicant who has already submitted +
 *  paid + approved parents + picked an exam date. Used to land directly
 *  on the post-exam-date 4-tab view, bypassing the wizard. */
export const SUBMITTED_APPLICANT_NID = '30407010103456';
export const SUBMITTED_APPLICANT_SESSION: MoiApplicantSession = {
  applicantId: 'APP-2026099',
  fullName: 'يوسف عمر فاروق منصور',
  nationalId: SUBMITTED_APPLICANT_NID,
  dateOfBirth: '2004-07-01',
  dateOfBirthAr: '١ يوليو ٢٠٠٤',
  gender: 'male',
  mobile: '01098765432',
  email: 'youssef.mansour@example.eg',
  birthGovernorate: 'الجيزة',
  birthDistrict: 'الدقي',
  religion: 'مسلم',
};

/** Demo-only prefill bundle for the submitted user. Both
 *  Stage345ApplicantDataPage (form prefill) and ApplicantPortalPage
 *  (read-only summary) read from this single source. */
export const SUBMITTED_APPLICANT_PROFILE = {
  /* Personal */
  shuhra: 'يوسف عمر',
  maritalStatus: 'single' as const,
  /* Bachelor */
  bachelorMajor: 'علوم سياسية',
  bachelorBranch: 'دراسات استراتيجية',
  bachelorSpecialization: 'سياسات أمنية',
  bachelorFaculty: 'الحقوق',
  bachelorUniversity: 'القاهرة',
  bachelorPercentage: 87.45,
  bachelorYear: 2025,
  /* Thanaweya */
  thanawiCountry: 'مصر',
  thanawiType: 'علمي علوم',
  thanawiTotal: 392,
  thanawiPercentage: 95.61,
  schoolNameAr: 'ثانوية النيل النموذجية',
  schoolAddress: 'الجيزة — شارع التحرير — الدقي',
  thanawiGradDate: '2024-07-15',
  /* Address */
  currentAddressDetail: '12 شارع البطل أحمد عبد العزيز — المهندسين',
  addressGovernorate: 'الجيزة',
  addressDistrict: 'المهندسين',
  /* Phones */
  homePhone: '0233456789',
  secondaryMobile: '01112345678',
  /* Social */
  facebook: 'youssef.mansour',
  twitter: '@youssef_m',
  instagram: 'youssef.mansour.ig',
};
export type SubmittedApplicantProfile = typeof SUBMITTED_APPLICANT_PROFILE;

/** Test-user catalog surfaced on the login page so demo runners know
 *  which NID exercises which scenario. */
export const DEMO_TEST_USERS = [
  {
    label: 'مؤهل (عام)',
    nationalId: MOI_APPLICANT_SESSION.nationalId,
    fullName: MOI_APPLICANT_SESSION.fullName,
    note: 'يجد المنظومة بياناته في وزارة الداخلية ويتأهَّل للقسم العام مباشرةً.',
  },
  {
    label: 'لم يُعثَر على البيانات',
    nationalId: MOHAMED_UNKNOWN_NID,
    fullName: '— (غير مسجَّل في الوزارة)',
    note: 'تنتقل المنظومة إلى شاشة اختيار فئة التقدم يدوياً.',
  },
  {
    label: 'غير مؤهَّل',
    nationalId: KHALED_NID,
    fullName: KHALED_SESSION.fullName,
    note: 'البيانات موجودة لكن المتقدِّم خارج الفئة العمرية للقبول.',
  },
  {
    label: 'بعد التقديم (موعد الإختبار محدَّد)',
    nationalId: SUBMITTED_APPLICANT_NID,
    fullName: SUBMITTED_APPLICANT_SESSION.fullName,
    note: 'سيدخل المتقدِّم مباشرةً إلى عرض التبويبات (البيانات / التنبيهات / كارت التردد / نتائج الاختبارات).',
  },
] as const;

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
  if (nid === KHALED_SESSION.nationalId) return KHALED_SESSION;
  if (nid === MOHAMED_UNKNOWN_NID) return null;
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

/**
 * Demo Thanaweya rows keyed by NID — used as a client-side fallback in
 * the applicant profile page when the real `/admin/grades` backend isn't
 * available (i.e. mock-only demo runs). Only known eligible NIDs need
 * entries; everyone else falls through to the manual-entry block.
 */
export interface DemoGradeRow {
  seatingNumber: string;
  branch: string;
  total: number;
  importMax: number;
  school: string;
  region: string;
  kind: 'general' | 'azhar';
  /** School country (e.g. مصر). Returned from the MOI grades lookup
   *  alongside the rest of the row — applicant doesn't re-enter it. */
  country: string;
  /** ISO yyyy-mm-dd graduation date. Returned from MOI for the matched
   *  Thanaweya row; applicant sees it read-only on the profile page. */
  graduationDate: string;
}

export const DEMO_APPLICANT_GRADES: Record<string, DemoGradeRow> = {
  [MOI_APPLICANT_SESSION.nationalId]: {
    seatingNumber: '142018',
    branch: 'علمي علوم',
    total: 392,
    importMax: 410,
    school: 'ثانوية النيل النموذجية',
    region: 'القاهرة',
    kind: 'general',
    country: 'مصر',
    graduationDate: '2024-07-15',
  },
};

/**
 * Scenario-driven lookup used by the applicant login flow.
 * Maps the 3 demo NIDs to explicit verdicts; any other valid NID is
 * treated as `not_found` (so unknown applicants land on the manual
 * category-selection screen rather than getting auto-eligible).
 */
export function mockMoiLookup(nid: string): MoiLookupResult {
  if (nid === MOI_APPLICANT_SESSION.nationalId) {
    return {
      kind: 'eligible',
      session: MOI_APPLICANT_SESSION,
      categoryKey: 'officers_general',
    };
  }
  if (nid === KHALED_SESSION.nationalId) {
    return {
      kind: 'ineligible',
      session: KHALED_SESSION,
      reasonAr: 'تخطَّى المتقدِّم الحدّ الأقصى للسنّ المقبول للالتحاق بالأكاديمية.',
    };
  }
  if (nid === SUBMITTED_APPLICANT_NID) {
    return {
      kind: 'eligible',
      session: SUBMITTED_APPLICANT_SESSION,
      categoryKey: 'officers_general',
    };
  }
  return { kind: 'not_found' };
}
