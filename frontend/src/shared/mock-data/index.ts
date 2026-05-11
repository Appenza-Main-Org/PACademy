/**
 * Centralized deterministic mock data — typed port of legacy js/services/mock-data.js.
 * Same seed → same data on every render. Generated at module load.
 */

import { reseed, rng, pick } from './seed';
import {
  ARABIC_FIRST_NAMES,
  ARABIC_MIDDLE_NAMES,
  ARABIC_LAST_NAMES,
  GOVERNORATES,
  GOVERNORATE_WEIGHTS,
  CITIES,
  CERTIFICATES,
  EGYPTIAN_SCHOOLS,
  STATUSES,
  STAGE_LABELS,
  COMMITTEES_NAMES,
} from './dictionaries';
import type {
  Applicant,
  AuditDiff,
  AuditEntry,
  Committee,
  DayPoint,
  ExamSession,
  Kpis,
  MedicalStation,
  Question,
  SessionStatus,
  SystemUser,
  UserActivityEntry,
} from '@/shared/types/domain';
import { QUESTION_POOL } from './questionPool';
/* REFERENCE_DATA dropped — superseded by MOCK.lookupItems filtered by
 * lookupTypeCode. The raw REF_* arrays in shared/mock-data/referenceData.ts
 * stay exported because non-admin pickers (applicant portal, board) read
 * them directly. */
import { ADMISSION_CYCLES, ADMISSION_RULES } from './admissionCycles';
import { APPLICANT_CATEGORIES, ACTIVE_CYCLE_ID } from './categories';
import { TEST_SCHEDULES } from './testSchedules';
import { EXAM_SLOTS, SAMPLE_DRAFT } from './applicantPortal';
import {
  BANK_QUESTIONS,
  BARCODES,
  BARCODE_SCANS,
  BIOMETRIC_ENROLLMENTS,
  BIOMETRIC_VERIFICATIONS,
  BOARD_DECISIONS,
  BOARD_MEMBERS,
  BOARD_SESSIONS,
  COMMITTEE_RESULTS,
  EXAM_ATTEMPTS,
  EXAM_CONFIGS,
  INVESTIGATION_CASES,
  MEDICAL_RESULTS,
  NOTIFICATIONS,
  OUTGOING_LETTERS,
} from './sprint3to9';
import {
  APPLICANT_WORKFLOW_PROGRESS,
  WORKFLOWS,
  WORKFLOW_TRANSITIONS,
} from './workflows';
import { LOOKUPS_SEED } from '@/features/lookups/mock/lookups.mock';
import { ACADEMY_EXAMS, CYCLE_CATEGORY_EXAM_PLANS } from './academyExams';
import { ROLE_DEFINITION_SEED } from './roles';
import { ADMIN_NOTIFICATIONS_SEED } from './adminNotifications';
import { buildAdminPayments } from './adminPayments';
import { OFFICER_DIRECTORY, findOfficerByNid, type OfficerDirectoryRow } from './officers';
import { CATEGORY_COMMITTEES_SEED } from './categoryCommittees';

reseed(42);

/* TIER 2 realism — Egyptian National ID format: CYYMMDDGGSSSSC
 *  C   century: 2 = born 1900s, 3 = born 2000s
 *  YY  birth year (last two digits)
 *  MM  birth month (01-12)
 *  DD  birth day (01-28)
 *  GG  governorate code (01-27 + 88 for foreign)
 *  SSSS serial within (G,Y,M,D)
 *  C   checksum digit (we don't compute Luhn here; demo only)
 * Applicants for cycle 2026 are 17-21 → born 2005-2008. */

const GOV_NID_CODES: Record<string, string> = {
  'القاهرة': '01', 'الإسكندرية': '02', 'بورسعيد': '03', 'السويس': '04', 'دمياط': '11',
  'الدقهلية': '12', 'الشرقية': '13', 'القليوبية': '14', 'كفر الشيخ': '15', 'الغربية': '16',
  'المنوفية': '17', 'البحيرة': '18', 'الإسماعيلية': '19', 'الجيزة': '21', 'بني سويف': '22',
  'الفيوم': '23', 'المنيا': '24', 'أسيوط': '25', 'سوهاج': '26', 'قنا': '27',
  'أسوان': '28', 'الأقصر': '29', 'البحر الأحمر': '31', 'الوادي الجديد': '32',
  'مرسى مطروح': '33', 'شمال سيناء': '34', 'جنوب سيناء': '35',
};

function pickWeightedGovernorate(): string {
  const total = GOVERNORATES.reduce((s, g) => s + (GOVERNORATE_WEIGHTS[g] ?? 1), 0);
  let r = rng() * total;
  for (const g of GOVERNORATES) {
    r -= GOVERNORATE_WEIGHTS[g] ?? 1;
    if (r <= 0) return g;
  }
  return GOVERNORATES[0]!;
}

function genNationalIdFor(governorate: string, birth: Date): string {
  const yr = String(birth.getFullYear()).slice(-2);
  const mo = String(birth.getMonth() + 1).padStart(2, '0');
  const dy = String(birth.getDate()).padStart(2, '0');
  const gov = GOV_NID_CODES[governorate] ?? '01';
  const serial = String(1000 + Math.floor(rng() * 8999));
  const checksum = String(Math.floor(rng() * 9));
  return `3${yr}${mo}${dy}${gov}${serial}${checksum}`;
}

/** Score distribution: weighted toward 75-90% of cert max (410 for thanwiya). */
function pickRealisticScore(): number {
  const r = rng();
  /* 60-75: 20% of population · 75-90: 60% · 90-100: 20% */
  let pct: number;
  if (r < 0.20) pct = 60 + rng() * 15;
  else if (r < 0.80) pct = 75 + rng() * 15;
  else pct = 90 + rng() * 10;
  return Math.round((pct / 100) * 410);
}

const TOTAL_APPLICANTS = 2847;

const applicants: Applicant[] = [];
for (let i = 0; i < TOTAL_APPLICANTS; i += 1) {
  const fname = pick(ARABIC_FIRST_NAMES);
  const middle = pick(ARABIC_MIDDLE_NAMES);
  const lname1 = pick(ARABIC_MIDDLE_NAMES);
  const lname2 = pick(ARABIC_LAST_NAMES);
  const cert = pick(CERTIFICATES);
  const totalScore = pickRealisticScore();
  const status = pick(STATUSES);
  const stage = Math.floor(rng() * STAGE_LABELS.length);
  const governorate = pickWeightedGovernorate();
  /* Born 2005-2008 = 17-21 years old in cycle 2026 */
  const birthYear = 2005 + Math.floor(rng() * 4);
  const birthMonth = Math.floor(rng() * 12);
  const birthDay = 1 + Math.floor(rng() * 28);
  const birth = new Date(birthYear, birthMonth, birthDay);
  applicants.push({
    id: `APP-${String(2026000000 + i + 1).padStart(10, '0')}`,
    nationalId: genNationalIdFor(governorate, birth),
    name: `${fname} ${middle} ${lname1} ${lname2}`,
    gender: rng() < 0.88 ? 'male' : 'female',
    birthDate: birth.toISOString(),
    governorate,
    city: pick(CITIES),
    certType: cert.type,
    certSection: cert.section,
    certScore: totalScore,
    certPercent: ((totalScore / 410) * 100).toFixed(2),
    certYear: 2025,
    status,
    stage,
    stageLabel: STAGE_LABELS[stage] ?? STAGE_LABELS[0]!,
    committee: pick(COMMITTEES_NAMES),
    registeredAt: new Date(Date.now() - Math.floor(rng() * 75 * 24 * 3600 * 1000)).toISOString(),
    paymentStatus: rng() < 0.78 ? 'paid' : 'pending',
    paymentAmount: 1500,
    hasDocuments: rng() < 0.72,
    photo: null,
    results: {
      medical: rng() < 0.40 ? null : rng() < 0.78 ? 'pass' : 'fail',
      fitness: rng() < 0.55 ? null : rng() < 0.72 ? 'pass' : 'fail',
      interview: rng() < 0.65 ? null : rng() < 0.82 ? 'pass' : 'fail',
      finalExam: rng() < 0.78 ? null : rng() < 0.65 ? 'pass' : 'fail',
    },
    familySize: 4 + Math.floor(rng() * 5),
    relativesCount: 6 + Math.floor(rng() * 12),
    investigation: rng() < 0.32 ? 'pending' : rng() < 0.88 ? 'cleared' : 'flagged',
  });
}

/** Helper for components that need to show a rich "school" reference. */
export function pickSchoolFor(_governorate: string): string {
  return EGYPTIAN_SCHOOLS[Math.floor(rng() * EGYPTIAN_SCHOOLS.length)]!;
}

/* Seed map: each legacy user is paired with an officer-directory row so the
 * extended SystemUser fields (nationalId, officerCode, mobile, userType)
 * are deterministic and match the NID lookup pool. */
const USER_SEED: Array<{
  id: string;
  legacyName: string;
  role: string;
  unit: string;
  active: boolean;
  lastLoginOffsetMs: number;
  nidIndex: number; /* index into OFFICER_DIRECTORY */
}> = [
  { id: 'U-001', legacyName: 'العميد د. أحمد محمود الفقي',  role: 'super_admin',     unit: 'كلية الشرطة',           active: true,  lastLoginOffsetMs: 3600000,         nidIndex: 0 },
  { id: 'U-002', legacyName: 'العقيد محمد إبراهيم حسن',     role: 'committee_admin', unit: 'لجان القبول',           active: true,  lastLoginOffsetMs: 7200000,         nidIndex: 1 },
  { id: 'U-003', legacyName: 'الرائد طارق علي الخطيب',      role: 'medical_admin',   unit: 'القومسيون الطبي',       active: true,  lastLoginOffsetMs: 1800000,         nidIndex: 5 },
  { id: 'U-004', legacyName: 'النقيب يوسف أحمد المصري',     role: 'investigator',    unit: 'إدارة التحريات',        active: true,  lastLoginOffsetMs: 86400000,        nidIndex: 6 },
  { id: 'U-005', legacyName: 'النقيب وليد سامح الديب',      role: 'committee_user',  unit: 'لجنة طلبة 1',           active: true,  lastLoginOffsetMs: 600000,          nidIndex: 3 },
  { id: 'U-006', legacyName: 'الملازم أول عمر حازم البنا',  role: 'biometric_user',  unit: 'بوابة الأمن',           active: true,  lastLoginOffsetMs: 300000,          nidIndex: 8 },
  { id: 'U-007', legacyName: 'العقيد أيمن شريف رمضان',      role: 'board_admin',     unit: 'الهيئة',                active: true,  lastLoginOffsetMs: 14400000,        nidIndex: 2 },
  { id: 'U-008', legacyName: 'الرائد ياسر هشام منصور',      role: 'exams_admin',     unit: 'الاختبارات الإلكترونية', active: true,  lastLoginOffsetMs: 4500000,         nidIndex: 7 },
  { id: 'U-009', legacyName: 'النقيب كريم زياد فاروق',      role: 'records_clerk',   unit: 'إدراج النتائج',         active: false, lastLoginOffsetMs: 7 * 86400000,    nidIndex: 4 },
  { id: 'U-010', legacyName: 'الرائد د. حسن محمد عبدالباقي', role: 'medical_doctor',  unit: 'عيادة الباطنة',         active: true,  lastLoginOffsetMs: 9000000,         nidIndex: 9 },
];

const SEED_NOW = Date.now();
/* Stable createdAt timestamps spread across the last 90 days so list
 * ordering is deterministic and demos don't all show "today". */
function seedCreatedAt(idx: number): string {
  return new Date(SEED_NOW - (90 - idx * 7) * 86_400_000).toISOString();
}

const users: SystemUser[] = USER_SEED.map((s, idx) => {
  const candidate = OFFICER_DIRECTORY[s.nidIndex] ?? OFFICER_DIRECTORY[0]!;
  const createdAt = seedCreatedAt(idx);
  return {
    id: s.id,
    name: candidate.fullArabicName,
    role: s.role,
    unit: s.unit,
    active: s.active,
    status: s.active ? 'active' : 'suspended',
    lastLogin: SEED_NOW - s.lastLoginOffsetMs,
    nationalId: candidate.nationalId,
    fullArabicName: candidate.fullArabicName,
    officerCode: candidate.officerCode,
    mobileNumber: candidate.mobileNumber,
    userType: candidate.userType,
    roles: [s.role],
    accountStatus: s.active ? 'active' : 'inactive',
    createdAt,
    updatedAt: createdAt,
  };
});

/* TIER 2 realism — 240 coherent audit entries.
 * Each entry pairs (action, module, entity, details) so the audit log reads
 * like genuine activity: the verb matches the entity and the `التفاصيل`
 * sentence names the section and the affected target. */

const AUDIT_SECTIONS: Record<NonNullable<AuditEntry['module']>, string> = {
  admin: 'لوحة الإدارة',
  auth: 'المصادقة وتسجيل الدخول',
  cycles: 'دورات القبول',
  categories: 'فئات المتقدمين',
  committees: 'لجان القبول',
  lookups: 'الأكواد المرجعية',
  exams: 'الاختبارات الإلكترونية',
  payments: 'المدفوعات',
  notifications: 'الإشعارات',
  roles: 'الأدوار والصلاحيات',
  users: 'مستخدمو النظام',
  workflows: 'سير العمل',
  applicants: 'ملفات المتقدمين',
};

type AuditScenarioContext = {
  applicant: Applicant;
  systemUser: SystemUser;
  actor: SystemUser;
  cycleName: string;
  categoryLabel: string;
  committeeName: string;
  examName: string;
  ip: string;
};

interface AuditScenario {
  weight: number;
  action: AuditEntry['action'];
  actionLabel: string;
  actionColor: AuditEntry['actionColor'];
  module: NonNullable<AuditEntry['module']>;
  entity: string;
  entityType: string;
  build: (ctx: AuditScenarioContext) => { details: string; entityId: string };
}

const APP_FIELD_GROUPS = [
  'contact.mobilePhone، contact.email',
  'currentAddress.detail، currentAddress.city',
  'education.certYear، education.certPercent',
  'maritalStatus، religion',
  'family.fatherName، family.fatherJob',
];

const STAGE_TRANSITIONS = [
  'pending → under-review · استكمال الفحص الأولي',
  'under-review → under_medical_review · إحالة للقومسيون الطبي',
  'under_medical_review → under_committee_review · إحالة للجنة القبول',
  'under_committee_review → under_investigation · بدء التحريات',
  'under_investigation → approved · اعتماد بعد ورود التحريات',
];

const NOTIFICATION_TITLES = [
  'فتح باب التقديم لدورة 2026',
  'تذكير بموعد اختبار القدرات',
  'إعلان مواعيد القومسيون الطبي',
  'تحديث الكشف النهائي للمقبولين',
];

const LOOKUP_TARGETS = [
  { key: 'المحافظات', value: 'محافظة جديدة (الوادي الجديد)' },
  { key: 'فئة المدرسة', value: 'الدبلوم الأمريكي' },
  { key: 'أسباب الرفض', value: 'الطول أقل من المطلوب' },
  { key: 'الجنسيات', value: 'مغربي' },
  { key: 'شعبة المتقدمين', value: 'علمي رياضة' },
];

const WORKFLOW_NAMES = [
  'سير عمل دورة الضباط 2026',
  'سير عمل القومسيون الطبي',
  'سير عمل التحريات',
];

const SCENARIOS: AuditScenario[] = [
  /* — applicants — */
  {
    weight: 14, action: 'update', actionLabel: 'تعديل بيانات المتقدم', actionColor: 'info',
    module: 'applicants', entity: 'متقدم', entityType: 'applicant',
    build: ({ applicant }) => ({
      details: `تعديل بيانات المتقدم ${applicant.name} (${applicant.id}) — تحديث الحقول: ${pick(APP_FIELD_GROUPS)} · قسم ${AUDIT_SECTIONS.applicants}`,
      entityId: applicant.id,
    }),
  },
  {
    weight: 10, action: 'view', actionLabel: 'استعلام عن الملف', actionColor: 'neutral',
    module: 'applicants', entity: 'متقدم', entityType: 'applicant',
    build: ({ applicant }) => ({
      details: `فتح ملف المتقدم ${applicant.name} (${applicant.id}) للمراجعة · قسم ${AUDIT_SECTIONS.applicants}`,
      entityId: applicant.id,
    }),
  },
  {
    weight: 12, action: 'applicant.transition', actionLabel: 'تحديث حالة المتقدم', actionColor: 'warning',
    module: 'applicants', entity: 'متقدم', entityType: 'applicant',
    build: ({ applicant }) => ({
      details: `تحديث حالة المتقدم ${applicant.name} (${applicant.id}): ${pick(STAGE_TRANSITIONS)} · قسم ${AUDIT_SECTIONS.applicants}`,
      entityId: applicant.id,
    }),
  },
  {
    weight: 6, action: 'create', actionLabel: 'إضافة المتقدم', actionColor: 'success',
    module: 'applicants', entity: 'متقدم', entityType: 'applicant',
    build: ({ applicant }) => ({
      details: `إنشاء ملف متقدم جديد — ${applicant.name} (${applicant.id}) · قسم ${AUDIT_SECTIONS.applicants}`,
      entityId: applicant.id,
    }),
  },
  {
    weight: 3, action: 'soft_delete', actionLabel: 'حذف ناعم', actionColor: 'warning',
    module: 'applicants', entity: 'متقدم', entityType: 'applicant',
    build: ({ applicant }) => ({
      details: `حذف ناعم لملف المتقدم ${applicant.name} (${applicant.id}) — السبب: تكرار التسجيل · قسم ${AUDIT_SECTIONS.applicants}`,
      entityId: applicant.id,
    }),
  },

  /* — cycles — */
  {
    weight: 2, action: 'cycle_activated', actionLabel: 'تفعيل دورة', actionColor: 'success',
    module: 'cycles', entity: 'دورة قبول', entityType: 'cycle',
    build: ({ cycleName }) => ({
      details: `تفعيل ${cycleName} وفتح باب التقديم · قسم ${AUDIT_SECTIONS.cycles}`,
      entityId: 'CYC-2026',
    }),
  },
  {
    weight: 3, action: 'cycle_extended', actionLabel: 'تمديد دورة', actionColor: 'info',
    module: 'cycles', entity: 'دورة قبول', entityType: 'cycle',
    build: ({ cycleName }) => ({
      details: `تمديد ${cycleName} لمدة 7 أيام إضافية بعد طلب اللجنة العليا · قسم ${AUDIT_SECTIONS.cycles}`,
      entityId: 'CYC-2026',
    }),
  },
  {
    weight: 2, action: 'cycle_closed', actionLabel: 'إغلاق دورة', actionColor: 'warning',
    module: 'cycles', entity: 'دورة قبول', entityType: 'cycle',
    build: ({ cycleName }) => ({
      details: `إغلاق باب التقديم في ${cycleName} وتثبيت قوائم المتقدمين · قسم ${AUDIT_SECTIONS.cycles}`,
      entityId: 'CYC-2026',
    }),
  },

  /* — categories — */
  {
    weight: 4, action: 'category_rules_changed', actionLabel: 'تعديل شروط فئة', actionColor: 'info',
    module: 'categories', entity: 'فئة متقدمين', entityType: 'category',
    build: ({ categoryLabel }) => ({
      details: `تعديل شروط فئة "${categoryLabel}" — تحديث الحد الأدنى للسن والمجموع · قسم ${AUDIT_SECTIONS.categories}`,
      entityId: 'CAT-001',
    }),
  },
  {
    weight: 2, action: 'category_rules_changed_with_override', actionLabel: 'تعديل شروط فئة (تجاوز)', actionColor: 'warning',
    module: 'categories', entity: 'فئة متقدمين', entityType: 'category',
    build: ({ categoryLabel }) => ({
      details: `تعديل شروط فئة "${categoryLabel}" مع تجاوز الفحص — بإذن اللجنة العليا · قسم ${AUDIT_SECTIONS.categories}`,
      entityId: 'CAT-001',
    }),
  },

  /* — committees — */
  {
    weight: 4, action: 'create', actionLabel: 'إنشاء لجنة', actionColor: 'success',
    module: 'committees', entity: 'لجنة قبول', entityType: 'committee',
    build: ({ committeeName }) => ({
      details: `إنشاء ${committeeName} وتعيين رئيس وأعضاء جدد · قسم ${AUDIT_SECTIONS.committees}`,
      entityId: 'C-NEW',
    }),
  },
  {
    weight: 4, action: 'update', actionLabel: 'تعديل تشكيل اللجنة', actionColor: 'info',
    module: 'committees', entity: 'لجنة قبول', entityType: 'committee',
    build: ({ committeeName }) => ({
      details: `تعديل تشكيل ${committeeName} — تحديث قائمة الأعضاء وعدد المتقدمين · قسم ${AUDIT_SECTIONS.committees}`,
      entityId: 'C-UPD',
    }),
  },

  /* — exams — */
  {
    weight: 6, action: 'create', actionLabel: 'إنشاء اختبار', actionColor: 'success',
    module: 'exams', entity: 'اختبار', entityType: 'exam',
    build: ({ examName }) => ({
      details: `إنشاء "${examName}" — جدولة موعد وربط بنك الأسئلة · قسم ${AUDIT_SECTIONS.exams}`,
      entityId: 'EX-NEW',
    }),
  },
  {
    weight: 4, action: 'update', actionLabel: 'تعديل اختبار', actionColor: 'info',
    module: 'exams', entity: 'اختبار', entityType: 'exam',
    build: ({ examName }) => ({
      details: `تحديث جدول "${examName}" — تعديل المدة من 45 إلى 60 دقيقة · قسم ${AUDIT_SECTIONS.exams}`,
      entityId: 'EX-UPD',
    }),
  },
  {
    weight: 4, action: 'export', actionLabel: 'تصدير نتائج', actionColor: 'warning',
    module: 'exams', entity: 'نتائج اختبار', entityType: 'exam_result',
    build: ({ examName }) => ({
      details: `تصدير نتائج "${examName}" بصيغة Excel لعدد 2,847 متقدم · قسم ${AUDIT_SECTIONS.exams}`,
      entityId: 'EX-RES',
    }),
  },

  /* — payments — */
  {
    weight: 8, action: 'payment_status_changed', actionLabel: 'تحديث حالة الدفع', actionColor: 'info',
    module: 'payments', entity: 'سداد رسوم', entityType: 'payment',
    build: ({ applicant }) => ({
      details: `تأكيد دفع رسوم التقديم — ${applicant.name} (${applicant.id}) · مبلغ 1,500 ج.م · قسم ${AUDIT_SECTIONS.payments}`,
      entityId: applicant.id,
    }),
  },
  {
    weight: 2, action: 'payment_refunded', actionLabel: 'إعادة مقابل مالي', actionColor: 'warning',
    module: 'payments', entity: 'سداد رسوم', entityType: 'payment',
    build: ({ applicant }) => ({
      details: `إعادة مقابل مالي إلى ${applicant.name} (${applicant.id}) — مبلغ 1,500 ج.م · قسم ${AUDIT_SECTIONS.payments}`,
      entityId: applicant.id,
    }),
  },

  /* — notifications — */
  {
    weight: 4, action: 'notification_published', actionLabel: 'نشر إشعار', actionColor: 'success',
    module: 'notifications', entity: 'إشعار', entityType: 'notification',
    build: () => {
      const title = pick(NOTIFICATION_TITLES);
      return {
        details: `نشر إشعار "${title}" لجميع المتقدمين · قسم ${AUDIT_SECTIONS.notifications}`,
        entityId: 'NTF-PUB',
      };
    },
  },
  {
    weight: 2, action: 'notification_unpublished', actionLabel: 'سحب إشعار', actionColor: 'warning',
    module: 'notifications', entity: 'إشعار', entityType: 'notification',
    build: () => {
      const title = pick(NOTIFICATION_TITLES);
      return {
        details: `سحب إشعار "${title}" قبل وصول جميع المستلمين · قسم ${AUDIT_SECTIONS.notifications}`,
        entityId: 'NTF-UNP',
      };
    },
  },

  /* — users — */
  {
    weight: 3, action: 'user_created', actionLabel: 'إنشاء حساب مستخدم', actionColor: 'success',
    module: 'users', entity: 'مستخدم نظام', entityType: 'user',
    build: ({ systemUser }) => ({
      details: `إنشاء حساب نظام جديد — ${systemUser.name} (${systemUser.role}) · قسم ${AUDIT_SECTIONS.users}`,
      entityId: systemUser.id,
    }),
  },
  {
    weight: 4, action: 'user_roles_changed', actionLabel: 'تعديل أدوار المستخدم', actionColor: 'info',
    module: 'users', entity: 'مستخدم نظام', entityType: 'user',
    build: ({ systemUser }) => ({
      details: `تعديل أدوار المستخدم ${systemUser.name} — منح صلاحية ${systemUser.role} · قسم ${AUDIT_SECTIONS.users}`,
      entityId: systemUser.id,
    }),
  },
  {
    weight: 3, action: 'user_status_changed', actionLabel: 'تغيير حالة المستخدم', actionColor: 'warning',
    module: 'users', entity: 'مستخدم نظام', entityType: 'user',
    build: ({ systemUser }) => ({
      details: `تعليق حساب المستخدم ${systemUser.name} بعد طلب الإدارة · قسم ${AUDIT_SECTIONS.users}`,
      entityId: systemUser.id,
    }),
  },

  /* — roles — */
  {
    weight: 3, action: 'update', actionLabel: 'تعديل دور', actionColor: 'info',
    module: 'roles', entity: 'دور صلاحية', entityType: 'role',
    build: () => ({
      details: `تعديل صلاحيات دور "مدير لجنة قبول" — إضافة صلاحية مراجعة الباركود · قسم ${AUDIT_SECTIONS.roles}`,
      entityId: 'ROLE-CA',
    }),
  },

  /* — lookups — */
  {
    weight: 3, action: 'create', actionLabel: 'إضافة قيمة مرجعية', actionColor: 'success',
    module: 'lookups', entity: 'قيمة مرجعية', entityType: 'lookup',
    build: () => {
      const t = pick(LOOKUP_TARGETS);
      return {
        details: `إضافة قيمة جديدة لقائمة "${t.key}": ${t.value} · قسم ${AUDIT_SECTIONS.lookups}`,
        entityId: 'LK-NEW',
      };
    },
  },
  {
    weight: 2, action: 'soft_delete', actionLabel: 'تعطيل قيمة مرجعية', actionColor: 'warning',
    module: 'lookups', entity: 'قيمة مرجعية', entityType: 'lookup',
    build: () => {
      const t = pick(LOOKUP_TARGETS);
      return {
        details: `تعطيل قيمة من قائمة "${t.key}": ${t.value} — لا تظهر في القوائم الجديدة · قسم ${AUDIT_SECTIONS.lookups}`,
        entityId: 'LK-DEL',
      };
    },
  },

  /* — workflows — */
  {
    weight: 2, action: 'workflow.publish', actionLabel: 'نشر سير العمل', actionColor: 'success',
    module: 'workflows', entity: 'سير عمل', entityType: 'workflow',
    build: () => {
      const w = pick(WORKFLOW_NAMES);
      return {
        details: `نشر "${w}" واعتمادها كسير العمل المعتمد للدورة الحالية · قسم ${AUDIT_SECTIONS.workflows}`,
        entityId: 'WF-PUB',
      };
    },
  },
  {
    weight: 2, action: 'workflow.reorder', actionLabel: 'إعادة ترتيب المراحل', actionColor: 'info',
    module: 'workflows', entity: 'سير عمل', entityType: 'workflow',
    build: () => {
      const w = pick(WORKFLOW_NAMES);
      return {
        details: `إعادة ترتيب مراحل "${w}" — نقل مرحلة القومسيون قبل لجنة القبول · قسم ${AUDIT_SECTIONS.workflows}`,
        entityId: 'WF-RE',
      };
    },
  },

  /* — auth — */
  {
    weight: 12, action: 'login_success', actionLabel: 'دخول ناجح', actionColor: 'success',
    module: 'auth', entity: 'جلسة دخول', entityType: 'session',
    build: ({ ip, actor }) => ({
      details: `تسجيل دخول ناجح للمستخدم ${actor.name} من IP ${ip} · قسم ${AUDIT_SECTIONS.auth}`,
      entityId: actor.id,
    }),
  },
  {
    weight: 4, action: 'login_failed', actionLabel: 'محاولة دخول فاشلة', actionColor: 'danger',
    module: 'auth', entity: 'جلسة دخول', entityType: 'session',
    build: ({ ip, actor }) => ({
      details: `محاولة دخول فاشلة باسم المستخدم ${actor.name} من IP ${ip} — كلمة مرور خاطئة · قسم ${AUDIT_SECTIONS.auth}`,
      entityId: actor.id,
    }),
  },
  {
    weight: 2, action: 'account_locked', actionLabel: 'إيقاف الحساب', actionColor: 'danger',
    module: 'auth', entity: 'جلسة دخول', entityType: 'session',
    build: ({ actor }) => ({
      details: `إيقاف حساب ${actor.name} مؤقتاً بعد 5 محاولات دخول فاشلة متتالية · قسم ${AUDIT_SECTIONS.auth}`,
      entityId: actor.id,
    }),
  },

  /* — admin — */
  {
    weight: 4, action: 'export', actionLabel: 'تصدير تقرير', actionColor: 'warning',
    module: 'admin', entity: 'تقرير', entityType: 'report',
    build: () => ({
      details: `تصدير تقرير لوحة الإدارة (PDF) — مؤشرات الدورة الحالية · قسم ${AUDIT_SECTIONS.admin}`,
      entityId: 'RPT-EXP',
    }),
  },
  {
    weight: 2, action: 'view', actionLabel: 'استعلام عن السجل', actionColor: 'neutral',
    module: 'admin', entity: 'سجل النشاط', entityType: 'audit',
    build: ({ actor }) => ({
      details: `استعلام عن سجل النشاط بواسطة ${actor.name} — فلترة على الإجراءات الإدارية · قسم ${AUDIT_SECTIONS.admin}`,
      entityId: 'AUD-VIEW',
    }),
  },
];

const TOTAL_WEIGHT = SCENARIOS.reduce((s, x) => s + x.weight, 0);

function pickScenario(): AuditScenario {
  let r = rng() * TOTAL_WEIGHT;
  for (const s of SCENARIOS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SCENARIOS[0]!;
}

const CYCLE_NAMES_FOR_AUDIT = ADMISSION_CYCLES.map((c) => c.nameAr);
const CATEGORY_LABELS_FOR_AUDIT = APPLICANT_CATEGORIES.map((c) => c.labelAr);
const EXAM_NAMES_FOR_AUDIT = [
  'اختبار القدرات 2026',
  'اختبار اللياقة البدنية 2026',
  'اختبار السمات الشخصية 2026',
  'الكشف الطبي الأولي 2026',
];

const audit: AuditEntry[] = [];
for (let i = 0; i < 240; i += 1) {
  const scenario = pickScenario();
  const actor = pick(users);
  const applicant = pick(applicants);
  const systemUser = pick(users);
  const cycleName = pick(CYCLE_NAMES_FOR_AUDIT);
  const categoryLabel = pick(CATEGORY_LABELS_FOR_AUDIT);
  const committeeName = pick(COMMITTEES_NAMES);
  const examName = pick(EXAM_NAMES_FOR_AUDIT);
  const ip = `41.65.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`;

  /* Bias toward recent: 50% in last 24h, 30% in last 7 days, 20% in last 30 days */
  const r = rng();
  let ageMs: number;
  if (r < 0.50) ageMs = Math.floor(rng() * 24 * 3600 * 1000);
  else if (r < 0.80) ageMs = Math.floor(rng() * 7 * 86400 * 1000);
  else ageMs = Math.floor(rng() * 30 * 86400 * 1000);
  const ts = Date.now() - ageMs;

  const { details, entityId } = scenario.build({
    applicant,
    systemUser,
    actor,
    cycleName,
    categoryLabel,
    committeeName,
    examName,
    ip,
  });

  audit.push({
    id: `AUD-${String(i + 1).padStart(6, '0')}`,
    userId: actor.id,
    userName: actor.name,
    role: actor.role,
    action: scenario.action,
    actionLabel: scenario.actionLabel,
    actionColor: scenario.actionColor,
    module: scenario.module,
    entity: scenario.entity,
    entityType: scenario.entityType,
    entityId,
    details,
    timestamp: ts,
    at: new Date(ts).toISOString(),
    ip,
  });
}
audit.sort((a, b) => b.timestamp - a.timestamp);

/* ── Per-applicant audit seed (admin-applicant-crud PR) ───────────────────
 * Adds 5–10 entity='applicant' entries for each of the first 60 seeded
 * applicants so the detail-page AuditTimeline never renders empty in demos.
 * Uses the deterministic LCG (rng()) so the same seed yields the same set. */
const APPLICANTS_WITH_AUDIT = applicants.slice(0, 60);
const APPLICANT_AUDIT_TEMPLATES: Array<{
  action: AuditEntry['action'];
  label: string;
  color: AuditEntry['actionColor'];
  detailFor: (a: Applicant) => string;
}> = [
  { action: 'create', label: 'إضافة المتقدم', color: 'success', detailFor: (a) => `تم إضافة المتقدم ${a.name}` },
  { action: 'update', label: 'تعديل بيانات المتقدم', color: 'info', detailFor: () => 'تعديل الحقول: contact.mobilePhone، currentAddress.detail' },
  { action: 'update', label: 'تعديل بيانات المتقدم', color: 'info', detailFor: () => 'تعديل الحقول: religion، maritalStatus' },
  { action: 'applicant.transition', label: 'تحديث حالة المتقدم', color: 'warning', detailFor: () => 'pending → under-review · استكمال الفحص الأولي' },
  { action: 'view', label: 'استعلام عن الملف', color: 'neutral', detailFor: () => 'فتح ملف المتقدم للمراجعة' },
  { action: 'applicant.transition', label: 'تحديث حالة المتقدم', color: 'warning', detailFor: () => 'under-review → under_medical_review · إحالة للقومسيون' },
  { action: 'update', label: 'تعديل بيانات المتقدم', color: 'info', detailFor: () => 'تعديل الحقول: contact.email' },
];

let applicantAuditSerial = 1;
for (const a of APPLICANTS_WITH_AUDIT) {
  const baseTs = new Date(a.registeredAt).getTime();
  const dayMs = 86_400_000;
  const count = 5 + Math.floor(rng() * 6);
  for (let i = 0; i < count; i += 1) {
    const tpl = APPLICANT_AUDIT_TEMPLATES[i % APPLICANT_AUDIT_TEMPLATES.length]!;
    const userIdx = Math.floor(rng() * users.length);
    const u = users[userIdx]!;
    const id = `AUD-AP-${String(applicantAuditSerial).padStart(6, '0')}`;
    applicantAuditSerial += 1;
    audit.push({
      id,
      userId: u.id,
      userName: u.name,
      action: tpl.action,
      actionLabel: tpl.label,
      actionColor: tpl.color,
      entity: 'applicant',
      entityId: a.id,
      details: tpl.detailFor(a),
      timestamp: baseTs + (i + 1) * dayMs * (0.3 + rng() * 0.8),
      ip: `10.0.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
    });
  }
}
audit.sort((a, b) => b.timestamp - a.timestamp);

/* Legacy Question[] view of the shared pool — drives the cards visible at
 * /question-bank. Categories deliberately match BANK_QUESTIONS (5 cats × 10),
 * so the categories overview, the filter Select, and this list stay coherent.
 * usedCount is deterministic (rng-driven) so the demo is reproducible. */
const questions: Question[] = QUESTION_POOL.map((q, i) => ({
  id: `Q-${String(i + 1).padStart(4, '0')}`,
  category: q.category,
  difficulty: q.difficultyLabel,
  text: q.text,
  options: [...q.options],
  correctIndex: q.correctIndex,
  usedCount: 50 + Math.floor(rng() * 320),
}));

/* TIER 2 — realistic medical station counts for a ~2,800-applicant cycle.
 * The 8 stations match RFP Scope Document §6.2.B exactly. Queue numbers are typical for
 * mid-morning. */
const medicalStations: MedicalStation[] = [
  { id: 'MS-01', name: 'الباطنة',                doctor: 'الرائد د. حسن محمد عبدالباقي',  queue: 47, completed: 312 },
  { id: 'MS-02', name: 'العظام',                 doctor: 'الرائد د. سامح فاروق نصر',     queue: 38, completed: 287 },
  { id: 'MS-03', name: 'الأنف والأذن والحنجرة',   doctor: 'الرائد د. رامي شعبان',          queue: 29, completed: 305 },
  { id: 'MS-04', name: 'العيون',                  doctor: 'الرائد د. أسامة الجمل',          queue: 52, completed: 268 },
  { id: 'MS-05', name: 'الجراحة العامة',           doctor: 'الرائد د. مروان الأنصاري',       queue: 18, completed: 324 },
  { id: 'MS-06', name: 'الأعصاب',                 doctor: 'الرائد د. زياد الزعيم',          queue: 24, completed: 296 },
  { id: 'MS-07', name: 'الاتزان النفسي',           doctor: 'الرائد د. هشام يحيى',           queue: 41, completed: 273 },
  { id: 'MS-08', name: 'القياسات (BMI)',          doctor: 'الرائد د. كريم البنا',          queue: 35, completed: 318 },
];

/* TIER 2 — committee counts scale with realistic load (~570 per committee). */
const COMMITTEE_CREATED_BASE = SEED_NOW - 60 * 86_400_000;
const committees: Committee[] = [
  {
    id: 'C-01', name: 'لجنة طلبة 1', head: 'العقيد محمد إبراهيم حسن', members: 5, applicants: 572, completed: 408,
    headUserId: 'U-002', capacity: 700, academicYearId: '2026-2027', status: 'active',
    createdAt: new Date(COMMITTEE_CREATED_BASE).toISOString(),
    specializationIds: ['officers_general', 'officers_specialized'], officerIds: ['U-002', 'U-005'],
    rules: { gradeFrom: 75, gradeTo: 100, alphabetFrom: 'أ', alphabetTo: 'د', gender: 'male', applicantType: 'thanaweya_amma' },
  },
  {
    id: 'C-02', name: 'لجنة طلبة 2', head: 'العقيد أحمد فاروق سعد', members: 5, applicants: 568, completed: 392,
    headUserId: 'U-002', capacity: 650, academicYearId: '2026-2027', status: 'active',
    createdAt: new Date(COMMITTEE_CREATED_BASE + 5 * 86_400_000).toISOString(),
    specializationIds: ['officers_general', 'postgraduate'], officerIds: ['U-002', 'U-005'],
    rules: { gradeFrom: 70, gradeTo: 100, alphabetFrom: 'ذ', alphabetTo: 'س', gender: 'male', applicantType: 'thanaweya_amma' },
  },
  {
    id: 'C-03', name: 'لجنة طلبة 3', head: 'الرائد طارق سامح الديب', members: 4, applicants: 569, completed: 425,
    headUserId: 'U-005', capacity: 700, academicYearId: '2026-2027', status: 'active',
    createdAt: new Date(COMMITTEE_CREATED_BASE + 10 * 86_400_000).toISOString(),
    specializationIds: ['officers_specialized', 'special_units'], officerIds: ['U-005'],
    rules: { gradeFrom: 80, gradeTo: 100, alphabetFrom: 'ش', alphabetTo: 'ع', gender: 'male', applicantType: 'azhar' },
  },
  {
    id: 'C-04', name: 'لجنة طلبة 4', head: 'الرائد محمود الديب البنا', members: 5, applicants: 571, completed: 387,
    headUserId: 'U-005', capacity: 650, academicYearId: '2026-2027', status: 'active',
    createdAt: new Date(COMMITTEE_CREATED_BASE + 18 * 86_400_000).toISOString(),
    specializationIds: ['institute_officers_training', 'institute_traffic'], officerIds: ['U-002', 'U-005'],
    rules: { gradeFrom: 70, gradeTo: 100, alphabetFrom: 'غ', alphabetTo: 'م', gender: 'male', applicantType: 'thanaweya_amma' },
  },
  {
    id: 'C-05', name: 'لجنة طلبة 5', head: 'الرائد عمر شعبان فاروق', members: 4, applicants: 567, completed: 401,
    headUserId: 'U-005', capacity: 600, academicYearId: '2025-2026', status: 'inactive',
    createdAt: new Date(COMMITTEE_CREATED_BASE + 25 * 86_400_000).toISOString(),
    specializationIds: ['institute_guarding', 'institute_traffic', 'special_units'], officerIds: ['U-005'],
    rules: { gradeFrom: 65, gradeTo: 100, alphabetFrom: 'ن', alphabetTo: 'ي', gender: 'female', applicantType: 'foreign_certificates' },
  },
];

/* TIER 2 — registrations per day scaled to a realistic admission window
 * (~150-280/day during the open period, with weekly weekend dips). */
const last14Days: DayPoint[] = [];
for (let i = 13; i >= 0; i -= 1) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const isWeekend = d.getDay() === 5 || d.getDay() === 6; // Fri/Sat
  const baseReg = isWeekend ? 110 : 200;
  last14Days.push({
    date: d.toISOString(),
    label: `${d.getDate()}/${d.getMonth() + 1}`,
    registrations: baseReg + Math.floor(rng() * 80),
    payments: Math.round((baseReg + Math.floor(rng() * 80)) * 0.78),
    tests: 60 + Math.floor(rng() * 80),
  });
}

const kpis: Kpis = {
  totalApplicants: applicants.length,
  paidApplicants: applicants.filter((a) => a.paymentStatus === 'paid').length,
  underReview: applicants.filter((a) => a.status === 'under-review').length,
  approved: applicants.filter((a) => a.status === 'approved').length,
  rejected: applicants.filter((a) => a.status === 'rejected').length,
  pending: applicants.filter((a) => a.status === 'pending').length,
  byGender: {
    male: applicants.filter((a) => a.gender === 'male').length,
    female: applicants.filter((a) => a.gender === 'female').length,
  },
  byCertType: applicants.reduce<Record<string, number>>((acc, a) => {
    acc[a.certType] = (acc[a.certType] ?? 0) + 1;
    return acc;
  }, {}),
};

/* ── Per-user activity log derived from audit entries (Sprint 1 §1.2.E) ─── */
const userActivity: UserActivityEntry[] = audit.map((a) => ({
  ts: a.timestamp,
  userId: a.userId,
  action: a.actionLabel,
  detail: a.details,
  ip: a.ip,
}));

/* ── Audit diffs (Sprint 1 §1.2.G) — deterministic before/after per entry ── */
const auditDiffs: Record<string, AuditDiff> = {};
for (const a of audit) {
  if (a.action === 'create') {
    auditDiffs[a.id] = { before: null, after: { id: a.entityId, status: 'pending' } };
  } else if (a.action === 'delete') {
    auditDiffs[a.id] = { before: { id: a.entityId, status: 'pending' }, after: null };
  } else if (a.action === 'update' && a.entity === 'applicant') {
    auditDiffs[a.id] = {
      before: {
        contact: { mobilePhone: '01001234567', email: 'old@example.com' },
        currentAddress: { detail: '15 شارع الجلاء' },
      },
      after: {
        contact: { mobilePhone: '01098765432', email: 'new@example.com' },
        currentAddress: { detail: '7 شارع التحرير، الدور الثالث' },
      },
    };
  } else if (a.action === 'update') {
    auditDiffs[a.id] = {
      before: { id: a.entityId, status: 'pending', stage: 1 },
      after: { id: a.entityId, status: 'under-review', stage: 2 },
    };
  } else {
    auditDiffs[a.id] = { before: null, after: null };
  }
}

/* ── Live exam sessions — proctor surface (RFP Scope Document §9.E).
 *  240 sessions for the first running exam, status-weighted to make the
 *  proctor screen feel realistic (~60% in-progress, 25% started,
 *  10% not-started, 5% dropped). The live service rotates statuses on
 *  each poll so the demo shows movement.
 */
const PROCTOR_EXAM_ID = 'EXAM-0001';
const PROCTOR_TOTAL_QUESTIONS = 50;
const PROCTOR_DURATION_SECONDS = 60 * 60; // 60 minutes
const PROCTOR_SESSION_COUNT = 240;

function pickSessionStatus(): SessionStatus {
  const r = rng();
  if (r < 0.60) return 'in-progress';
  if (r < 0.85) return 'started';
  if (r < 0.95) return 'not-started';
  return 'dropped';
}

const liveExamSessions: ExamSession[] = [];
const nowSeed = Date.now();
for (let i = 0; i < PROCTOR_SESSION_COUNT; i += 1) {
  const applicant = applicants[i] ?? applicants[i % applicants.length]!;
  const status = pickSessionStatus();
  const startedOffsetMs = Math.floor(60_000 + rng() * 40 * 60_000); // 1–41 min ago
  const startedAt = status === 'not-started' ? null : nowSeed - startedOffsetMs;
  const heartbeatOffset = status === 'dropped'
    ? Math.floor(120_000 + rng() * 600_000) // 2–12 min ago — clearly stale
    : Math.floor(rng() * 45_000); // ≤ 45s ago
  const lastHeartbeatAt = startedAt === null ? null : nowSeed - heartbeatOffset;
  const answered = status === 'in-progress'
    ? Math.floor(rng() * (PROCTOR_TOTAL_QUESTIONS - 4))
    : status === 'started'
      ? Math.floor(rng() * 3)
      : status === 'dropped'
        ? Math.floor(rng() * (PROCTOR_TOTAL_QUESTIONS / 2))
        : 0;
  liveExamSessions.push({
    id: `SESS-${String(i + 1).padStart(5, '0')}`,
    examId: PROCTOR_EXAM_ID,
    applicantId: applicant.id,
    applicantName: applicant.name,
    status,
    startedAt,
    lastHeartbeatAt,
    questionsAnswered: answered,
    totalQuestions: PROCTOR_TOTAL_QUESTIONS,
    durationSeconds: PROCTOR_DURATION_SECONDS,
    ip: `10.${20 + Math.floor(rng() * 30)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
    mac: Array.from({ length: 6 }, () => Math.floor(rng() * 256).toString(16).padStart(2, '0').toUpperCase()).join(':'),
  });
}

/* ── Hour×day heatmap data (Sprint 1 §1.2.H) — 7 days × 24 hours of registration counts. ── */
const heatmapHourDay: number[][] = [];
for (let day = 0; day < 7; day += 1) {
  const row: number[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    /* Peak hours 9-13 + 18-22 with lower activity at night, weekend bump on Fri/Sat. */
    const isPeak = (hour >= 9 && hour <= 13) || (hour >= 18 && hour <= 22);
    const weekendBoost = day >= 5 ? 1.2 : 1;
    const base = isPeak ? 18 : hour < 7 || hour > 23 ? 1 : 6;
    row.push(Math.floor(base * weekendBoost * (0.7 + rng() * 0.6)));
  }
  heatmapHourDay.push(row);
}

reseed(42);

export const MOCK = {
  applicants,
  users,
  audit,
  auditDiffs,
  userActivity,
  questions,
  medicalStations,
  committees,
  last14Days,
  kpis,
  governorates: GOVERNORATES,
  stageLabels: STAGE_LABELS,
  /* Sprint 1 additions */
  admissionCycles: ADMISSION_CYCLES,
  admissionRules: ADMISSION_RULES,
  heatmapHourDay,
  /* Sprint 2 additions */
  examSlots: EXAM_SLOTS,
  sampleApplicantDraft: SAMPLE_DRAFT,
  /* Sprints 3-9 additions */
  committeeResults: COMMITTEE_RESULTS,
  medicalResults: MEDICAL_RESULTS,
  investigationCases: INVESTIGATION_CASES,
  outgoingLetters: OUTGOING_LETTERS,
  boardMembers: BOARD_MEMBERS,
  boardSessions: BOARD_SESSIONS,
  boardDecisions: BOARD_DECISIONS,
  bankQuestions: BANK_QUESTIONS,
  examConfigs: EXAM_CONFIGS,
  examAttempts: EXAM_ATTEMPTS,
  biometricEnrollments: BIOMETRIC_ENROLLMENTS,
  biometricVerifications: BIOMETRIC_VERIFICATIONS,
  barcodes: BARCODES,
  barcodeScans: BARCODE_SCANS,
  notifications: NOTIFICATIONS,
  /* Post-polish additions (Buckets B/C/E) */
  categories: APPLICANT_CATEGORIES,
  cycles: ADMISSION_CYCLES,
  activeCycleId: ACTIVE_CYCLE_ID,
  testSchedules: TEST_SCHEDULES,
  /* Live proctor surface (RFP §9.E) */
  liveExamSessions,
  /* Department workflow builder (RFP §3 / §6) */
  workflows: WORKFLOWS,
  applicantWorkflowProgress: APPLICANT_WORKFLOW_PROGRESS,
  workflowTransitions: WORKFLOW_TRANSITIONS,
  /* Lookup Management Module — 18 typed lookups keyed by LookupKey. */
  lookups: LOOKUPS_SEED,
  /* Academy exam catalogue (admin-gaps Gap J) */
  academyExams: ACADEMY_EXAMS,
  cycleCategoryExamPlans: CYCLE_CATEGORY_EXAM_PLANS,
  /* Dynamic roles + permission matrix (admin-gaps Gap C) */
  roleDefinitions: ROLE_DEFINITION_SEED,
  /* Admin-authored notifications (admin-gaps Gap L) */
  adminNotifications: ADMIN_NOTIFICATIONS_SEED,
  /* Admin Fawry payment ledger (admin-gaps Gap K) */
  adminPayments: buildAdminPayments(applicants),
  /* Officer / civilian / contractor directory — admin-create NID flow */
  officers: OFFICER_DIRECTORY,
  /* Admission-setup wizard — committee ↔ category bindings (academic year scoped) */
  categoryCommittees: CATEGORY_COMMITTEES_SEED,
};

export { findOfficerByNid };
export type { OfficerDirectoryRow };
