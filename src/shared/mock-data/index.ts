/**
 * Centralized deterministic mock data — typed port of legacy js/services/mock-data.js.
 * Same seed → same data on every render. Generated at module load.
 */

import { reseed, rng, pick } from './seed';
import {
  ARABIC_FIRST_NAMES,
  ARABIC_LAST_NAMES,
  GOVERNORATES,
  CITIES,
  CERTIFICATES,
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
  Kpis,
  MedicalStation,
  Question,
  SystemUser,
  UserActivityEntry,
} from '@/shared/types/domain';
import { REFERENCE_DATA } from './referenceData';
import { ADMISSION_CYCLES, ADMISSION_RULES } from './admissionCycles';
import { EXAM_SLOTS, SAMPLE_DRAFT } from './applicantPortal';

reseed(42);

function genNationalId(): string {
  const century = '2';
  const yr = String(rng() < 0.5 ? Math.floor(rng() * 9 + 1) : Math.floor(rng() * 5)).padStart(2, '0');
  const mo = String(Math.floor(rng() * 12) + 1).padStart(2, '0');
  const dy = String(Math.floor(rng() * 28) + 1).padStart(2, '0');
  const gov = String(Math.floor(rng() * 27) + 1).padStart(2, '0');
  const serial = String(Math.floor(rng() * 9999)).padStart(4, '0');
  const last = String(Math.floor(rng() * 9));
  return `${century}${yr}${mo}${dy}${gov}${serial}${last}`;
}

const applicants: Applicant[] = [];
for (let i = 0; i < 240; i += 1) {
  const fname = pick(ARABIC_FIRST_NAMES);
  const lname1 = pick(ARABIC_FIRST_NAMES);
  const lname2 = pick(ARABIC_LAST_NAMES);
  const cert = pick(CERTIFICATES);
  const totalScore = 380 + Math.floor(rng() * 30);
  const status = pick(STATUSES);
  const stage = Math.floor(rng() * STAGE_LABELS.length);
  applicants.push({
    id: `APP-${String(2026000 + i).padStart(7, '0')}`,
    nationalId: genNationalId(),
    name: `${fname} ${lname1} ${lname2}`,
    gender: rng() < 0.85 ? 'male' : 'female',
    birthDate: new Date(2002 + Math.floor(rng() * 5), Math.floor(rng() * 12), Math.floor(rng() * 28) + 1).toISOString(),
    governorate: pick(GOVERNORATES),
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
    registeredAt: new Date(Date.now() - Math.floor(rng() * 60 * 24 * 3600 * 1000)).toISOString(),
    paymentStatus: rng() < 0.7 ? 'paid' : 'pending',
    paymentAmount: 1500,
    hasDocuments: rng() < 0.6,
    photo: null,
    results: {
      medical: rng() < 0.5 ? null : rng() < 0.75 ? 'pass' : 'fail',
      fitness: rng() < 0.6 ? null : rng() < 0.7 ? 'pass' : 'fail',
      interview: rng() < 0.7 ? null : rng() < 0.8 ? 'pass' : 'fail',
      finalExam: rng() < 0.85 ? null : rng() < 0.6 ? 'pass' : 'fail',
    },
    familySize: 4 + Math.floor(rng() * 4),
    relativesCount: 6 + Math.floor(rng() * 8),
    investigation: rng() < 0.4 ? 'pending' : rng() < 0.85 ? 'cleared' : 'flagged',
  });
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

const audit: AuditEntry[] = [];
for (let i = 0; i < 80; i += 1) {
  const u = pick(users);
  const a = pick(AUDIT_ACTIONS);
  const target = pick(applicants);
  audit.push({
    id: `AUD-${String(i + 1).padStart(6, '0')}`,
    userId: u.id,
    userName: u.name,
    action: a.action,
    actionLabel: a.label,
    actionColor: a.color,
    entity: pick(['متقدم', 'مستخدم', 'نتيجة اختبار', 'تقرير', 'إعداد نظام']),
    entityId: target.id,
    details: pick([
      `تعديل بيانات المتقدم ${target.name}`,
      `إضافة نتيجة اختبار طبي`,
      `استعلام عن سجل التحريات`,
      `تسجيل دخول من IP 192.168.1.45`,
      `تصدير تقرير إحصائي`,
      `عرض الملف الإلكتروني`,
    ]),
    timestamp: Date.now() - Math.floor(rng() * 7 * 86400 * 1000),
    ip: `192.168.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
  });
}
audit.sort((a, b) => b.timestamp - a.timestamp);

const questions: Question[] = [
  { id: 'Q-0001', category: 'ثقافة عامة',  difficulty: 'سهل',    text: 'ما هي عاصمة جمهورية مصر العربية؟', options: ['الإسكندرية', 'القاهرة', 'الجيزة', 'أسوان'], correctIndex: 1, usedCount: 248 },
  { id: 'Q-0002', category: 'تاريخ مصر',    difficulty: 'متوسط',  text: 'في أي عام قامت ثورة 23 يوليو؟', options: ['1948', '1950', '1952', '1956'], correctIndex: 2, usedCount: 187 },
  { id: 'Q-0003', category: 'رياضيات',      difficulty: 'متوسط',  text: 'إذا كان المتوسط الحسابي لخمسة أعداد يساوي 12، فما مجموعها؟', options: ['50', '55', '60', '65'], correctIndex: 2, usedCount: 312 },
  { id: 'Q-0004', category: 'لغة عربية',    difficulty: 'سهل',    text: 'ما الجمع الصحيح لكلمة "كتاب"؟', options: ['كتب', 'كتائب', 'كتابات', 'أكتاب'], correctIndex: 0, usedCount: 156 },
  { id: 'Q-0005', category: 'منطق',         difficulty: 'صعب',   text: 'إذا كان جميع المهندسين مبدعين، وبعض المبدعين رياضيون، فإن:', options: ['جميع المهندسين رياضيون', 'بعض المهندسين رياضيون', 'لا يمكن تحديد العلاقة', 'لا يوجد مهندس رياضي'], correctIndex: 2, usedCount: 94 },
  { id: 'Q-0006', category: 'لغة إنجليزية', difficulty: 'متوسط',  text: 'Choose the correct sentence:', options: ["He don't know the answer.", "He doesn't knows the answer.", "He doesn't know the answer.", 'He not know the answer.'], correctIndex: 2, usedCount: 211 },
  { id: 'Q-0007', category: 'جغرافيا',      difficulty: 'سهل',    text: 'أطول نهر في العالم هو:', options: ['نهر الأمازون', 'نهر النيل', 'نهر اليانغتسي', 'نهر المسيسبي'], correctIndex: 1, usedCount: 178 },
  { id: 'Q-0008', category: 'ثقافة عامة',  difficulty: 'متوسط',  text: 'في أي مدينة يقع مقر منظمة الأمم المتحدة الرئيسي؟', options: ['جنيف', 'نيويورك', 'باريس', 'فيينا'], correctIndex: 1, usedCount: 145 },
];

const medicalStations: MedicalStation[] = [
  { id: 'MS-01', name: 'الباطنة', doctor: 'د. حسن محمد عبدالباقي', queue: 12, completed: 47 },
  { id: 'MS-02', name: 'العظام', doctor: 'د. سامح فاروق نصر', queue: 8, completed: 52 },
  { id: 'MS-03', name: 'الأنف والأذن والحنجرة', doctor: 'د. رامي شعبان', queue: 5, completed: 60 },
  { id: 'MS-04', name: 'العيون', doctor: 'د. أسامة الجمل', queue: 14, completed: 41 },
  { id: 'MS-05', name: 'الجلدية', doctor: 'د. مروان الأنصاري', queue: 3, completed: 65 },
  { id: 'MS-06', name: 'الأسنان', doctor: 'د. زياد الزعيم', queue: 9, completed: 48 },
  { id: 'MS-07', name: 'النفسية', doctor: 'د. هشام يحيى', queue: 11, completed: 44 },
  { id: 'MS-08', name: 'الأشعة', doctor: 'د. كريم البنا', queue: 7, completed: 56 },
];

const committees: Committee[] = [
  { id: 'C-01', name: 'لجنة طلبة 1', head: 'العقيد محمد إبراهيم', members: 5, applicants: 48, completed: 30 },
  { id: 'C-02', name: 'لجنة طلبة 2', head: 'العقيد أحمد فاروق', members: 5, applicants: 52, completed: 27 },
  { id: 'C-03', name: 'لجنة طلبة 3', head: 'الرائد طارق سامح', members: 4, applicants: 45, completed: 33 },
  { id: 'C-04', name: 'لجنة طلبة 4', head: 'الرائد محمود الديب', members: 5, applicants: 50, completed: 28 },
  { id: 'C-05', name: 'لجنة طلبة 5', head: 'الرائد عمر شعبان', members: 4, applicants: 47, completed: 31 },
];

const last14Days: DayPoint[] = [];
for (let i = 13; i >= 0; i -= 1) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  last14Days.push({
    date: d.toISOString(),
    label: `${d.getDate()}/${d.getMonth() + 1}`,
    registrations: 80 + Math.floor(rng() * 80),
    payments: 60 + Math.floor(rng() * 60),
    tests: 40 + Math.floor(rng() * 50),
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
  } else if (a.action === 'update') {
    auditDiffs[a.id] = {
      before: { id: a.entityId, status: 'pending', stage: 1 },
      after: { id: a.entityId, status: 'under-review', stage: 2 },
    };
  } else {
    auditDiffs[a.id] = { before: null, after: null };
  }
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
};
