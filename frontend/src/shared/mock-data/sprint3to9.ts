/**
 * Mock data for Sprints 3-9 — committees results, medical results,
 * investigations cases + outgoing letters, board sessions/decisions/members,
 * question bank + exams + attempts, biometric enrollments + verifications,
 * barcodes + scans, notifications.
 *
 * All deterministic via the existing LCG seed.
 */

import { rng, pick } from './seed';
import type {
  BankQuestion,
  BarcodeRecord,
  BarcodeScan,
  BiometricEnrollment,
  BiometricVerification,
  BoardDecision,
  BoardMember,
  BoardSession,
  CommitteeResult,
  ExamAttempt,
  ExamConfig,
  InvestigationCase,
  MedicalExamResult,
  MedicalStationKey,
  NotificationItem,
  OutgoingLetter,
} from '@/shared/types/domain';

/* The applicants array is generated earlier — this file consumes a
 * subset for cross-references via the seeded rng().                  */
import { MOCK_APPLICANTS_FOR_REFS } from './_applicantsRefs';
import { QUESTION_POOL } from './questionPool';

const now = Date.now();
const day = 86_400_000;

/* ── Sprint 3 — committee results ────────────────────────────────── */
export const COMMITTEE_RESULTS: CommitteeResult[] = (() => {
  const out: CommitteeResult[] = [];
  for (let i = 0; i < 80; i += 1) {
    const a = pick(MOCK_APPLICANTS_FOR_REFS);
    const passFail = rng() < 0.7 ? 'pass' : 'fail';
    out.push({
      id: `RES-C-${String(i + 1).padStart(5, '0')}`,
      committeeId: `C-0${(i % 5) + 1}`,
      applicantId: a.id,
      applicantName: a.name,
      enteredBy: 'النقيب وليد سامح الديب',
      enteredAt: now - Math.floor(rng() * 5 * day),
      phase: i % 4 === 0 ? 'preliminary' : 'final',
      scores: { writtenTest: 60 + Math.floor(rng() * 40), interview: 60 + Math.floor(rng() * 40) },
      passFail,
    });
  }
  return out;
})();

/* ── Sprint 4 — medical results (8 stations × ~12 entries) ──────── */
const STATIONS: MedicalStationKey[] = ['eye', 'ent', 'internal', 'orthopedic', 'neuro', 'psychology', 'surgery', 'bmi'];
export const MEDICAL_RESULTS: MedicalExamResult[] = (() => {
  const out: MedicalExamResult[] = [];
  let id = 1;
  for (const station of STATIONS) {
    for (let i = 0; i < 14; i += 1) {
      const a = pick(MOCK_APPLICANTS_FOR_REFS);
      const verdict = rng() < 0.7 ? 'pass' : rng() < 0.6 ? 'conditional' : 'fail';
      out.push({
        id: `RES-M-${String(id++).padStart(5, '0')}`,
        applicantId: a.id,
        applicantName: a.name,
        station,
        doctor: `د. ${pick(['حسن', 'سامح', 'رامي', 'أسامة'])} ${pick(['عبدالباقي', 'فاروق', 'شعبان', 'الجمل'])}`,
        enteredAt: now - Math.floor(rng() * 4 * day),
        phase: i % 5 === 0 ? 'preliminary' : 'final',
        verdict,
        fields: stationFields(station),
      });
    }
  }
  return out;
})();

function stationFields(s: MedicalStationKey): Record<string, string | number | boolean> {
  if (s === 'eye') return { acuityRight: '6/9', acuityLeft: '6/9', colorVision: 'normal', pressureRight: 14, pressureLeft: 15 };
  if (s === 'ent') return { hearingRight: 25, hearingLeft: 28, tympanic: 'normal' };
  if (s === 'internal') return { bloodPressure: '120/80', heartRate: 72, respRate: 16, temp: 36.7 };
  if (s === 'orthopedic') return { spine: 'normal', footType: 'normal', flexibility: 'good', previousFractures: false };
  if (s === 'neuro') return { reflexes: 'normal', coordination: 'normal', cognitive: 'normal' };
  if (s === 'psychology') return { stressResponse: 'good', personalityScore: 78 };
  if (s === 'surgery') return { hernias: false, varicose: false, scars: 'none' };
  /* bmi */
  return { heightCm: 178, weightKg: 73, chestInhale: 92, chestExhale: 86, bmi: 23.0 };
}

/* ── Sprint 5 — investigations cases + outgoing letters ─────────── */
export const INVESTIGATION_CASES: InvestigationCase[] = (() => {
  const out: InvestigationCase[] = [];
  for (let i = 0; i < 60; i += 1) {
    const a = pick(MOCK_APPLICANTS_FOR_REFS);
    const statuses = ['open', 'in-review', 'pass', 'fail', 'defer-conditional'] as const;
    const caseTypes = ['committee-A', 'committee-C', 'data-review'] as const;
    const priorities = ['low', 'medium', 'high', 'critical'] as const;
    out.push({
      id: `CASE-${String(i + 1).padStart(5, '0')}`,
      applicantId: a.id,
      applicantName: a.name,
      caseType: pick(caseTypes),
      assignedTo: 'U-004',
      priority: pick(priorities),
      dueDate: new Date(now + (3 + Math.floor(rng() * 14)) * day).toISOString(),
      openedAt: now - Math.floor(rng() * 30 * day),
      status: pick(statuses),
    });
  }
  return out;
})();

export const OUTGOING_LETTERS: OutgoingLetter[] = (() => {
  const recipients = ['الإدارة العامة للأحوال المدنية', 'الإدارة العامة لمكافحة المخدرات', 'مديرية الأمن — القاهرة', 'وزارة الخارجية'];
  return Array.from({ length: 18 }, (_, i) => ({
    id: `LET-${String(i + 1).padStart(5, '0')}`,
    to: recipients[i % recipients.length] ?? recipients[0],
    subject: 'استعلام عن سجل المتقدم',
    template: 'standard-inquiry',
    status: pick([
      'drafted', 'sent', 'acknowledged', 'responded', 'closed',
    ]),
    sentAt: now - Math.floor(rng() * 20 * day),
  }));
})();

/* ── Sprint 6 — board members + sessions + decisions ─────────────── */
export const BOARD_MEMBERS: BoardMember[] = [
  { id: 'BM-01', name: 'اللواء د. محمود سعيد علي', rank: 'لواء', role: 'chair' },
  { id: 'BM-02', name: 'العقيد أيمن شريف رمضان', rank: 'عقيد', role: 'secretary' },
  { id: 'BM-03', name: 'العميد د. أحمد محمود الفقي', rank: 'عميد', role: 'member' },
  { id: 'BM-04', name: 'العقيد محمد إبراهيم حسن', rank: 'عقيد', role: 'member' },
  { id: 'BM-05', name: 'الرائد طارق علي الخطيب', rank: 'رائد', role: 'member' },
];

export const BOARD_SESSIONS: BoardSession[] = (() => {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `SES-${String(i + 1).padStart(4, '0')}`,
    date: new Date(now + (i - 6) * 7 * day).toISOString(),
    time: '10:00',
    location: 'قاعة الاجتماعات الكبرى - أكاديمية الشرطة',
    agenda: ['مراجعة طلبات قبول مستجدة', 'إقرار نتائج المرحلة السابقة', 'النظر في حالات الاستئناف'],
    attendees: BOARD_MEMBERS.map((m) => m.id),
    applicantIds: MOCK_APPLICANTS_FOR_REFS.slice(i * 4, i * 4 + 4).map((a) => a.id),
    status: i < 6 ? 'closed' : i === 6 ? 'live' : 'scheduled',
  }));
})();

export const BOARD_DECISIONS: BoardDecision[] = (() => {
  const out: BoardDecision[] = [];
  let n = 1;
  for (const s of BOARD_SESSIONS) {
    if (s.status !== 'closed') continue;
    for (const aid of s.applicantIds) {
      const outcomes = ['accepted', 'rejected', 'deferred'] as const;
      const outcome = pick(outcomes);
      out.push({
        id: `DEC-${String(n).padStart(5, '0')}`,
        number: `د/2026/${String(n).padStart(4, '0')}`,
        date: s.date,
        hijriDate: '15 شوال 1447',
        sessionId: s.id,
        applicantId: aid,
        outcome,
        body: outcomeBody(outcome),
        signatures: BOARD_MEMBERS.slice(0, 3).map((m) => m.name),
      });
      n += 1;
    }
  }
  return out;
})();

function outcomeBody(o: 'accepted' | 'rejected' | 'deferred'): string {
  if (o === 'accepted')
    return 'بناءً على ما تقدّم، وبعد الاطلاع على ملف المتقدم وإحاطة الهيئة علماً بنتائج كافة المراحل، تقرّر قبول المتقدم رسمياً ضمن دفعة هذا العام.';
  if (o === 'rejected')
    return 'بناءً على ما تقدّم، ووفقاً للمعايير المعتمدة وعدم استيفاء بعض الشروط الجوهرية، تقرّر رفض الطلب وحفظ الملف.';
  return 'بناءً على ما تقدّم، وحيث ثمّة بنود تحتاج إلى توضيح إضافي، تقرّر تأجيل البتّ في الطلب لجلسة لاحقة وفق ما تستلزمه الإجراءات.';
}

/* ── Sprint 7 — question bank + exams + attempts ─────────────────── */
/* Backed by the shared QUESTION_POOL (50 real Arabic MCQs, 5 cats × 10).
 * Difficulty is mapped from the pool's tri-tier label to the BankQuestion
 * 1–5 scale; status is sliced (live/review/draft) so the CRUD screens have
 * something to demonstrate the approval flow against. */
const DIFFICULTY_FROM_LABEL: Record<'سهل' | 'متوسط' | 'صعب', 1 | 2 | 3 | 4 | 5> = {
  سهل: 2,
  متوسط: 3,
  صعب: 4,
};

export const BANK_QUESTIONS: BankQuestion[] = QUESTION_POOL.map((q, i) => ({
  id: `Q-${String(i + 1).padStart(5, '0')}`,
  category: q.category,
  difficulty: DIFFICULTY_FROM_LABEL[q.difficultyLabel],
  type: 'mcq',
  text: q.text,
  options: [...q.options],
  correctIndex: q.correctIndex,
  timeLimitSeconds: 45 + Math.floor(rng() * 75),
  status: i < 35 ? 'live' : i < 45 ? 'review' : 'draft',
  version: 1,
}));

export const EXAM_CONFIGS: ExamConfig[] = [
  {
    id: 'EXAM-2026-CAP-01',
    nameAr: 'اختبار القدرات — دورة 2026',
    cycleId: 'CYC-2026-M',
    scheduledFor: new Date(now + 14 * day).toISOString(),
    rules: [
      { category: 'قدرات لفظية', difficultyMin: 2, difficultyMax: 4, count: 15, minutes: 15 },
      { category: 'قدرات عددية', difficultyMin: 2, difficultyMax: 4, count: 15, minutes: 15 },
      { category: 'منطق', difficultyMin: 3, difficultyMax: 5, count: 10, minutes: 20 },
    ],
    questionIds: BANK_QUESTIONS.slice(0, 40).map((q) => q.id),
    status: 'published',
  },
  {
    id: 'EXAM-2026-TRT-01',
    nameAr: 'اختبار السمات — دورة 2026',
    cycleId: 'CYC-2026-M',
    scheduledFor: new Date(now + 21 * day).toISOString(),
    rules: [{ category: 'ثقافة عامة', difficultyMin: 1, difficultyMax: 3, count: 30, minutes: 30 }],
    questionIds: BANK_QUESTIONS.slice(0, 30).map((q) => q.id),
    status: 'draft',
  },
];

export const EXAM_ATTEMPTS: ExamAttempt[] = (() => {
  const out: ExamAttempt[] = [];
  for (let i = 0; i < 200; i += 1) {
    const a = pick(MOCK_APPLICANTS_FOR_REFS);
    const score = 50 + Math.floor(rng() * 50);
    out.push({
      id: `ATT-${String(i + 1).padStart(5, '0')}`,
      examId: 'EXAM-2026-CAP-01',
      applicantId: a.id,
      startedAt: now - Math.floor(rng() * 14 * day),
      submittedAt: now - Math.floor(rng() * 14 * day) + 1800_000,
      answers: {},
      flagged: [],
      score,
      passFail: score >= 60 ? 'pass' : 'fail',
    });
  }
  return out;
})();

/* ── Sprint 8 — biometric enrollments + verifications + barcodes ── */
export const BIOMETRIC_ENROLLMENTS: BiometricEnrollment[] = (() => {
  return MOCK_APPLICANTS_FOR_REFS.slice(0, 180).map((a, i) => ({
    id: `BIO-${String(i + 1).padStart(5, '0')}`,
    applicantId: a.id,
    enrolledAt: now - Math.floor(rng() * 30 * day),
    faceCaptured: true,
    fingerprintCaptured: rng() > 0.05,
    livenessConfirmed: true,
    templateRef: `tmpl/${a.id}`,
  }));
})();

export const BIOMETRIC_VERIFICATIONS: BiometricVerification[] = (() => {
  const out: BiometricVerification[] = [];
  for (let i = 0; i < 120; i += 1) {
    const a = pick(MOCK_APPLICANTS_FOR_REFS);
    const match = rng() > 0.06;
    out.push({
      id: `VER-${String(i + 1).padStart(5, '0')}`,
      applicantId: a.id,
      station: pick(['gate', 'exam-room', 'committee']),
      ts: now - Math.floor(rng() * 7 * day),
      method: pick(['face', 'fingerprint', 'barcode']),
      match,
      confidence: match ? Math.floor(80 + rng() * 18) : Math.floor(40 + rng() * 30),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
})();

export const BARCODES: BarcodeRecord[] = (() => {
  return MOCK_APPLICANTS_FOR_REFS.map((a, i) => ({
    applicantId: a.id,
    code: `26-${a.governorate.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(8, '0')}`,
    cycleId: 'CYC-2026-M',
    governorateCode: a.governorate.slice(0, 3).toUpperCase(),
    issuedAt: now - Math.floor(rng() * 30 * day),
    void: rng() < 0.04,
  }));
})();

export const BARCODE_SCANS: BarcodeScan[] = (() => {
  const out: BarcodeScan[] = [];
  for (let i = 0; i < 200; i += 1) {
    const a = pick(MOCK_APPLICANTS_FOR_REFS);
    out.push({
      id: `SCN-${String(i + 1).padStart(5, '0')}`,
      ts: now - Math.floor(rng() * 7 * day),
      scannedBy: 'U-006',
      applicantId: a.id,
      station: pick(['البوابة الرئيسية', 'لجنة طلبة 1', 'القومسيون الطبي', 'قاعة الاختبارات']),
      action: pick(['attendance', 'gate-in', 'gate-out', 'forward']),
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
})();

/* ── Sprint 9 — notifications ────────────────────────────────────── */
export const NOTIFICATIONS: NotificationItem[] = [
  { id: 'NTF-001', ts: now - 30 * 60_000,    recipientRole: 'committee_admin', type: 'approval',  title: 'نتائج بانتظار الاعتماد', body: '12 نتيجة لجنة جاهزة للاعتماد النهائي', read: false, href: '/committee/list' },
  { id: 'NTF-002', ts: now - 90 * 60_000,    recipientRole: 'medical_admin',   type: 'capacity',   title: 'تحذير سعة', body: 'عيادة الباطنة تجاوزت 90% من السعة اليومية', read: false, href: '/medical/queue' },
  { id: 'NTF-003', ts: now - 4  * 3600_000,  recipientRole: 'investigator',    type: 'assignment', title: 'قضية جديدة', body: 'تم إسناد قضية CASE-00041 إليك', read: true, href: '/investigations' },
  { id: 'NTF-004', ts: now - 8  * 3600_000,  recipientRole: 'applicant',       type: 'stage',      title: 'تم اعتماد طلبك', body: 'تم اعتماد بياناتك التعليمية. يمكنك الآن سداد الرسوم', read: false, href: '/applicant' },
  { id: 'NTF-005', ts: now - 24 * 3600_000,  recipientRole: 'super_admin',     type: 'system',     title: 'فشل تكامل', body: 'انقطاع مؤقت مع خدمة MOIPASS — تم استعادة الاتصال', read: true },
  { id: 'NTF-006', ts: now - 45 * 60_000,    recipientRole: 'super_admin',     type: 'system',     title: 'تنبيه أمني', body: 'محاولة دخول فاشلة من عنوان IP خارج الشبكة المسموحة', read: false, href: '/admin/audit' },
  { id: 'NTF-007', ts: now - 2  * 3600_000,  recipientRole: 'board_admin',     type: 'approval',  title: 'جلسة هيئة وشيكة', body: 'الجلسة الأسبوعية تبدأ خلال ساعتين — 12 ملفاً على جدول الأعمال', read: false, href: '/board/sessions' },
  { id: 'NTF-008', ts: now - 6  * 3600_000,  recipientRole: 'exams_admin',     type: 'system',     title: 'انتهاء اختبار قدرات', body: 'انتهى اختبار القدرات بنجاح — 240 جلسة مكتملة من أصل 240', read: false, href: '/question-bank/results' },
  { id: 'NTF-009', ts: now - 12 * 3600_000,  recipientRole: 'medical_admin',   type: 'capacity',   title: 'تحديث جدول الفحص', body: 'تم تحريك 35 موعداً من غدٍ إلى الأحد بسبب إجازة رسمية', read: true, href: '/medical/queue' },
  { id: 'NTF-010', ts: now - 18 * 3600_000,  recipientRole: 'committee_admin', type: 'assignment', title: 'مهمة مراجعة', body: 'تم تعيينك لمراجعة 8 ملفات معاد فتحها بناءً على قرار الهيئة', read: false, href: '/committee/list' },
  { id: 'NTF-011', ts: now - 36 * 3600_000,  recipientRole: 'super_admin',     type: 'system',     title: 'تحديث متاح', body: 'إصدار جديد من المنظومة v1.2 جاهز للنشر — راجع ملاحظات الإصدار', read: true },
  { id: 'NTF-012', ts: now - 48 * 3600_000,  recipientRole: 'investigator',    type: 'assignment', title: 'تقرير تحريات', body: 'وردت ٣ تقارير تحريات جديدة من إدارة التأمين الجنائي', read: true, href: '/investigations/incoming' },
];
