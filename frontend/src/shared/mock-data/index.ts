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
  AUDIT_ACTIONS,
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
import { REFERENCE_DATA } from './referenceData';
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
import { LOOKUP_SEED } from './lookups';

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

const users: SystemUser[] = [
  { id: 'U-001', name: 'العميد د. أحمد محمود الفقي', role: 'super_admin', unit: 'كلية الشرطة', active: true, lastLogin: Date.now() - 3600000 },
  { id: 'U-002', name: 'العقيد محمد إبراهيم حسن', role: 'committee_admin', unit: 'لجان القبول', active: true, lastLogin: Date.now() - 7200000 },
  { id: 'U-003', name: 'الرائد طارق علي الخطيب', role: 'medical_admin', unit: 'القومسيون الطبي', active: true, lastLogin: Date.now() - 1800000 },
  { id: 'U-004', name: 'النقيب يوسف أحمد المصري', role: 'investigator', unit: 'إدارة التحريات', active: true, lastLogin: Date.now() - 86400000 },
  { id: 'U-005', name: 'النقيب وليد سامح الديب', role: 'committee_user', unit: 'لجنة طلبة 1', active: true, lastLogin: Date.now() - 600000 },
  { id: 'U-006', name: 'الملازم أول عمر حازم البنا', role: 'biometric_user', unit: 'بوابة الأمن', active: true, lastLogin: Date.now() - 300000 },
  { id: 'U-007', name: 'العقيد أيمن شريف رمضان', role: 'board_admin', unit: 'الهيئة', active: true, lastLogin: Date.now() - 14400000 },
  { id: 'U-008', name: 'الرائد ياسر هشام منصور', role: 'exams_admin', unit: 'الاختبارات الإلكترونية', active: true, lastLogin: Date.now() - 4500000 },
  { id: 'U-009', name: 'النقيب كريم زياد فاروق', role: 'records_clerk', unit: 'إدراج النتائج', active: false, lastLogin: Date.now() - 7 * 86400000 },
  { id: 'U-010', name: 'الرائد د. حسن محمد عبدالباقي', role: 'medical_doctor', unit: 'عيادة الباطنة', active: true, lastLogin: Date.now() - 9000000 },
];

/* TIER 2 realism — bump from 80 → 240 audit events to match 2,847 applicants
 * with realistic activity rate. Spread across last 7 days with a weighted
 * lean toward today/yesterday for the "live" feel. */
const audit: AuditEntry[] = [];
for (let i = 0; i < 240; i += 1) {
  const u = pick(users);
  const a = pick(AUDIT_ACTIONS);
  const target = pick(applicants);
  /* Bias toward recent: 50% in last 24h, 30% in last 7 days, 20% in last 30 days */
  const r = rng();
  let ageMs: number;
  if (r < 0.50) ageMs = Math.floor(rng() * 24 * 3600 * 1000);
  else if (r < 0.80) ageMs = Math.floor(rng() * 7 * 86400 * 1000);
  else ageMs = Math.floor(rng() * 30 * 86400 * 1000);

  audit.push({
    id: `AUD-${String(i + 1).padStart(6, '0')}`,
    userId: u.id,
    userName: u.name,
    action: a.action,
    actionLabel: a.label,
    actionColor: a.color,
    entity: pick(['متقدم', 'مستخدم', 'نتيجة اختبار', 'تقرير', 'إعداد نظام', 'لجنة', 'دورة قبول']),
    entityId: target.id,
    details: pick([
      `تعديل بيانات المتقدم ${target.name}`,
      `اعتماد نتيجة اختبار قدرات`,
      `استعلام عن سجل التحريات`,
      `تسجيل دخول من IP 41.65.92.${Math.floor(rng() * 255)}`,
      `تصدير تقرير إحصائي PDF`,
      `عرض الملف الإلكتروني للمتقدم`,
      `إصدار باركود بدل فاقد`,
      `حفظ نتيجة قومسيون طبي`,
      `إقرار قرار جلسة هيئة`,
    ]),
    timestamp: Date.now() - ageMs,
    ip: `41.65.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
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
const committees: Committee[] = [
  { id: 'C-01', name: 'لجنة طلبة 1', head: 'العقيد محمد إبراهيم حسن',    members: 5, applicants: 572, completed: 408 },
  { id: 'C-02', name: 'لجنة طلبة 2', head: 'العقيد أحمد فاروق سعد',       members: 5, applicants: 568, completed: 392 },
  { id: 'C-03', name: 'لجنة طلبة 3', head: 'الرائد طارق سامح الديب',      members: 4, applicants: 569, completed: 425 },
  { id: 'C-04', name: 'لجنة طلبة 4', head: 'الرائد محمود الديب البنا',    members: 5, applicants: 571, completed: 387 },
  { id: 'C-05', name: 'لجنة طلبة 5', head: 'الرائد عمر شعبان فاروق',     members: 4, applicants: 567, completed: 401 },
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
  referenceData: REFERENCE_DATA,
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
  /* Generic lookup matrix (admin-gaps Gap I) */
  lookups: LOOKUP_SEED,
};
