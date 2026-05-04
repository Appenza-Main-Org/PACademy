/**
 * Reports command center — super_admin admissions overview.
 *
 * INTEGRATION CONTRACT — replace each method body with a real call.
 *
 *   GET /api/admin/reports/cycle-snapshot          → CycleSnapshot
 *   GET /api/admin/reports/funnel?cycleId=         → StageFunnelPoint[]
 *   GET /api/admin/reports/by-department?cycleId=  → DepartmentReport
 *   GET /api/admin/reports/test-results?cycleId=   → TestResultsReport
 *   GET /api/admin/reports/operational-status      → OperationalStatus
 *   GET /api/admin/reports/governance?range=24h    → GovernanceReport
 *   GET /api/admin/reports/integrations            → IntegrationStatus[]
 *
 * Demo computes aggregates on the fly from MOCK collections plus a
 * deterministic string hash for any synthesised value (e.g. department
 * assignment, days-at-stage, hour-of-day buckets). Math.random() is
 * never used in render-path computation. Date.now() is replaced with
 * the constant NOW so the dashboard renders byte-identical numbers
 * across reloads (LCG seed integrity preserved).
 */

import { simulateLatency } from '@/shared/lib/mock-helpers';
import { MOCK } from '@/shared/mock-data';
import { STAGE_LABELS } from '@/shared/lib/constants';
import type {
  AnomalySignal,
  ApplicantCategoryKey,
  AuditHourBucket,
  BoardSessionOpStatus,
  CommitteeOpStatus,
  CycleSnapshot,
  DepartmentReport,
  DepartmentSummary,
  EligibilityRejectionReason,
  GovernanceReport,
  IntegrationStatus,
  MedicalStationOpStatus,
  OngoingExamStatus,
  OperationalStatus,
  RejectionReasonStat,
  StageFunnelPoint,
  TestKindForReport,
  TestKindResult,
  TestResultsReport,
} from '@/shared/types/domain';

/* ── Constants ───────────────────────────────────────────────────────── */

/** Frozen "now" — used for every relative timestamp. Keeps the dashboard
 *  byte-identical across reloads regardless of wall-clock drift. */
export const NOW = new Date('2026-05-15T10:00:00+02:00');
const NOW_MS = NOW.getTime();
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Top-level cycle the dashboard reports against. */
const ACTIVE_CYCLE_ID = MOCK.activeCycleId;

const TEST_KIND_LABEL: Record<TestKindForReport, string> = {
  medical: 'الكشف الطبي',
  physical: 'الاختبار الرياضي',
  psychological: 'الاختبار النفسي',
  interview: 'مقابلة شخصية',
  drug: 'تحليل مخدرات',
};

const REJECTION_LABEL: Record<EligibilityRejectionReason, string> = {
  cycle_not_active: 'لا توجد دورة قبول نشطة',
  application_closed: 'باب التقديم مغلق',
  nomination_required: 'بالترشيح فقط',
  age_out_of_range: 'السن خارج النطاق المسموح',
  gender_mismatch: 'النوع لا يطابق الفئة',
  data_not_found: 'البيانات غير متاحة لدى التربية والتعليم',
  score_below_min: 'المجموع أقل من الحد الأدنى',
  nid_already_used: 'الرقم القومي مستخدم سابقاً',
  qualification_mismatch: 'المؤهل لا يطابق متطلبات الفئة',
  height_below_min: 'الطول أقل من الحد الأدنى',
  marital_status_mismatch: 'الحالة الاجتماعية لا تطابق الشروط',
};

const FALLBACK_CATEGORIES: { key: ApplicantCategoryKey; labelAr: string }[] = [
  { key: 'officers_general', labelAr: 'قسم الضباط (القسم العام)' },
  { key: 'officers_specialized', labelAr: 'قسم الضباط المتخصصين' },
  { key: 'postgraduate', labelAr: 'الدراسات العليا' },
  { key: 'institute_officers_training', labelAr: 'معهد تدريب الضباط' },
  { key: 'institute_traffic', labelAr: 'معهد المرور' },
  { key: 'institute_guarding', labelAr: 'معهد الحراسات والتأمين' },
  { key: 'special_units', labelAr: 'الوحدات الخاصة' },
];

const HIGH_SENSITIVITY_PATTERNS: readonly string[] = [
  'إقرار قرار',
  'حفظ نتيجة قومسيون',
  'اعتماد نتيجة',
  'إصدار باركود بدل فاقد',
  'تحديث حالة المتقدم',
];

/* ── Pure deterministic helpers ──────────────────────────────────────── */

/** FNV-1a-style hash → 0..1. Pure, deterministic, no Math.random. */
function hashFloat(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  /* Mix the high bits down to keep the distribution uniform across short keys. */
  h ^= h >>> 13;
  h = Math.imul(h, 2654435761);
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function hashInt(seed: string, max: number): number {
  return Math.floor(hashFloat(seed) * max) % Math.max(1, max);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/* ── Activity heuristics ─────────────────────────────────────────────── */

/** Approximate active cycle's open date, used for "days since open" buckets. */
function cycleOpenDate(): Date {
  const cycle = MOCK.cycles.find((c) => c.id === ACTIVE_CYCLE_ID);
  return cycle ? new Date(cycle.openDate) : new Date('2025-02-15T00:00:00.000Z');
}

function cycleCloseDate(): Date {
  const cycle = MOCK.cycles.find((c) => c.id === ACTIVE_CYCLE_ID);
  return cycle ? new Date(cycle.closeDate) : new Date('2026-12-31T23:59:59.000Z');
}

function activeCycleLabel(): string {
  const cycle = MOCK.cycles.find((c) => c.id === ACTIVE_CYCLE_ID);
  return cycle?.nameAr ?? 'الدورة الحالية';
}

function activeCycleCapacity(): number | null {
  const cycle = MOCK.cycles.find((c) => c.id === ACTIVE_CYCLE_ID);
  return cycle?.expectedCapacity ?? null;
}

/** Map an applicant deterministically into one of the 7 departments. */
function applicantDepartment(applicantId: string): ApplicantCategoryKey {
  const idx = hashInt(`${applicantId}:dept`, FALLBACK_CATEGORIES.length);
  return FALLBACK_CATEGORIES[idx]!.key;
}

/** Deterministic eligibility outcome per applicant. */
function applicantEligibility(applicantId: string): 'passed' | 'failed' | 'pending' {
  const r = hashFloat(`${applicantId}:elig`);
  if (r < 0.62) return 'passed';
  if (r < 0.84) return 'failed';
  return 'pending';
}

/** Deterministic top-failure reason for a failing applicant. */
function applicantRejectionReason(applicantId: string): EligibilityRejectionReason {
  const reasons: EligibilityRejectionReason[] = [
    'score_below_min',
    'age_out_of_range',
    'data_not_found',
    'qualification_mismatch',
    'height_below_min',
    'marital_status_mismatch',
    'gender_mismatch',
  ];
  const r = hashFloat(`${applicantId}:rej`);
  /* Weighted: score 32%, age 22%, data 14%, qualification 12%, height 10%, marital 6%, gender 4%. */
  if (r < 0.32) return 'score_below_min';
  if (r < 0.54) return 'age_out_of_range';
  if (r < 0.68) return 'data_not_found';
  if (r < 0.80) return 'qualification_mismatch';
  if (r < 0.90) return 'height_below_min';
  if (r < 0.96) return 'marital_status_mismatch';
  return reasons[6]!;
}

/** Deterministic pass/fail/pending per applicant × test kind. Reuses
 *  applicant.results when the kind has a direct mapping; synthesises the
 *  rest from a stable hash. */
function applicantTestOutcome(
  applicantId: string,
  kind: TestKindForReport,
): 'passed' | 'failed' | 'pending' {
  const a = MOCK.applicants.find((x) => x.id === applicantId);
  if (a) {
    if (kind === 'medical') return mapResult(a.results.medical);
    if (kind === 'physical') return mapResult(a.results.fitness);
    if (kind === 'interview') return mapResult(a.results.interview);
  }
  /* Synthesise psychological + drug from a deterministic hash. */
  const r = hashFloat(`${applicantId}:${kind}`);
  if (r < 0.55) return 'passed';
  if (r < 0.78) return 'failed';
  return 'pending';
}

function mapResult(r: 'pass' | 'fail' | null): 'passed' | 'failed' | 'pending' {
  if (r === 'pass') return 'passed';
  if (r === 'fail') return 'failed';
  return 'pending';
}

/* ── Service ─────────────────────────────────────────────────────────── */

export const reportsService = {
  async getCycleSnapshot(): Promise<CycleSnapshot> {
    await simulateLatency(180, 320);

    const total = MOCK.applicants.length;
    const finalApproved = MOCK.applicants.filter((a) => a.status === 'approved').length;
    const reachedFinal = MOCK.applicants.filter(
      (a) => a.status === 'approved' || a.status === 'rejected',
    ).length;
    const acceptanceRate = pct(finalApproved, Math.max(reachedFinal, 1));
    /* Prior-cycle anchor: 2.4pp lower deterministic anchor for y-o-y storytelling. */
    const prevCycleAcceptanceRate = Math.max(0, Math.round((acceptanceRate - 2.4) * 10) / 10);

    /* 30-day registration tempo, bucketed deterministically by applicant id hash. */
    const days = 30;
    const thisCycleBuckets = new Array<number>(days).fill(0);
    const prevCycleBuckets = new Array<number>(days).fill(0);
    for (const a of MOCK.applicants) {
      const idx = hashInt(`${a.id}:tempo`, days);
      thisCycleBuckets[idx] = (thisCycleBuckets[idx] ?? 0) + 1;
    }
    for (let i = 0; i < days; i += 1) {
      /* Prior cycle: same shape, scaled by ~0.86–0.94 with a small day-of-week wobble. */
      const wobble = 0.86 + hashFloat(`prev:${i}`) * 0.08;
      prevCycleBuckets[i] = Math.round((thisCycleBuckets[i] ?? 0) * wobble);
    }
    const thisCycleTotal = thisCycleBuckets.reduce((s, v) => s + v, 0);
    const prevCycleTotal = prevCycleBuckets.reduce((s, v) => s + v, 0);
    const deltaPercent = pct(thisCycleTotal - prevCycleTotal, Math.max(prevCycleTotal, 1));

    const close = cycleCloseDate();
    const open = cycleOpenDate();
    const daysRemaining = Math.max(0, Math.floor((close.getTime() - NOW_MS) / DAY_MS));

    const cycle = MOCK.cycles.find((c) => c.id === ACTIVE_CYCLE_ID);
    const categoriesOpen = FALLBACK_CATEGORIES.map((c) => {
      const cfg = cycle?.openCategories?.[c.key];
      return {
        key: c.key,
        labelAr: c.labelAr,
        isOpen: Boolean(cfg?.isOpen),
        capacity: cfg?.capacity ?? null,
      };
    });

    const integrations = await reportsService.getIntegrationStatus();
    const integrationsHealthy = integrations.filter((i) => i.status === 'healthy').length;

    const labelFor = (i: number): string => {
      const d = new Date(open.getTime() + i * DAY_MS);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    };

    return {
      cycleId: ACTIVE_CYCLE_ID,
      cycleLabelAr: activeCycleLabel(),
      openDateIso: open.toISOString(),
      closeDateIso: close.toISOString(),
      hijriCloseDate: '12 جمادى الآخرة 1448',
      daysRemaining,
      capacity: activeCycleCapacity(),
      totalApplicants: total,
      finalApproved,
      acceptanceRate,
      prevCycleAcceptanceRate,
      registrationTempo: {
        thisCycle: thisCycleBuckets.map((value, i) => ({ label: labelFor(i), value })),
        prevCycle: prevCycleBuckets.map((value, i) => ({ label: labelFor(i), value })),
        deltaPercent,
      },
      categoriesOpen,
      integrationsHealthy,
      integrationsTotal: integrations.length,
      generatedAt: NOW.toISOString(),
    };
  },

  async getStageFunnel(): Promise<StageFunnelPoint[]> {
    await simulateLatency(180, 320);
    const total = MOCK.applicants.length;
    const counts = new Array<number>(STAGE_LABELS.length).fill(0);
    for (const a of MOCK.applicants) {
      const idx = clamp(a.stage, 0, STAGE_LABELS.length - 1);
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
    /* Convert per-stage *current* counts to a monotonically-decreasing funnel of
     * "applicants who reached at least this stage". */
    const reachedAtLeast = new Array<number>(STAGE_LABELS.length).fill(0);
    let running = 0;
    for (let i = STAGE_LABELS.length - 1; i >= 0; i -= 1) {
      running += counts[i] ?? 0;
      reachedAtLeast[i] = running;
    }

    /* Average days at stage — deterministic from the stage index alone (so the
     * bottleneck label is stable). */
    const avgDays = STAGE_LABELS.map((_, i) => {
      const r = hashFloat(`stage:${i}`);
      return Math.round((0.5 + r * 6.5) * 10) / 10;
    });
    const slowestStage = avgDays.indexOf(Math.max(...avgDays));

    return STAGE_LABELS.map((label, i) => {
      const reached = reachedAtLeast[i] ?? 0;
      const prev = i > 0 ? reachedAtLeast[i - 1] ?? 0 : reached;
      const dropOff = prev > 0 ? Math.round(((prev - reached) / prev) * 1000) / 10 : 0;
      return {
        stageIndex: i,
        stageLabel: label,
        count: reached,
        percentOfTotal: pct(reached, Math.max(total, 1)),
        dropOffFromPrevPercent: dropOff,
        avgDaysAtStage: avgDays[i] ?? 0,
        isBottleneck: i === slowestStage,
      };
    });
  },

  async getDepartmentReport(): Promise<DepartmentReport> {
    await simulateLatency(180, 320);
    const total = MOCK.applicants.length;
    const labelMap = new Map<ApplicantCategoryKey, string>();
    if (MOCK.categories?.length) {
      for (const c of MOCK.categories) labelMap.set(c.key, c.labelAr);
    }
    for (const c of FALLBACK_CATEGORIES) {
      if (!labelMap.has(c.key)) labelMap.set(c.key, c.labelAr);
    }

    const summaryByKey = new Map<ApplicantCategoryKey, DepartmentSummary>();
    for (const c of FALLBACK_CATEGORIES) {
      summaryByKey.set(c.key, {
        key: c.key,
        labelAr: labelMap.get(c.key) ?? c.labelAr,
        total: 0,
        percentOfTotal: 0,
        eligibilityPassed: 0,
        eligibilityFailed: 0,
        eligibilityPending: 0,
        eligibilityPassRate: 0,
      });
    }

    const reasonCounts = new Map<EligibilityRejectionReason, number>();
    for (const a of MOCK.applicants) {
      const dept = applicantDepartment(a.id);
      const summary = summaryByKey.get(dept)!;
      summary.total += 1;
      const outcome = applicantEligibility(a.id);
      if (outcome === 'passed') summary.eligibilityPassed += 1;
      else if (outcome === 'failed') {
        summary.eligibilityFailed += 1;
        const reason = applicantRejectionReason(a.id);
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      } else summary.eligibilityPending += 1;
    }

    const byDepartment = Array.from(summaryByKey.values()).map((s) => ({
      ...s,
      percentOfTotal: pct(s.total, Math.max(total, 1)),
      eligibilityPassRate: pct(s.eligibilityPassed, Math.max(s.eligibilityPassed + s.eligibilityFailed, 1)),
    }));
    byDepartment.sort((a, b) => b.eligibilityPassRate - a.eligibilityPassRate);

    const totalRejections = Array.from(reasonCounts.values()).reduce((s, v) => s + v, 0);
    const topRejectionReasons: RejectionReasonStat[] = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        labelAr: REJECTION_LABEL[reason],
        count,
        percent: pct(count, Math.max(totalRejections, 1)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { byDepartment, topRejectionReasons };
  },

  async getTestResultsReport(): Promise<TestResultsReport> {
    await simulateLatency(180, 320);
    const kinds: TestKindForReport[] = ['medical', 'physical', 'psychological', 'interview', 'drug'];

    const byKind: TestKindResult[] = kinds.map((kind) => {
      let passed = 0;
      let failed = 0;
      let pending = 0;
      for (const a of MOCK.applicants) {
        const out = applicantTestOutcome(a.id, kind);
        if (out === 'passed') passed += 1;
        else if (out === 'failed') failed += 1;
        else pending += 1;
      }
      const passRate = pct(passed, Math.max(passed + failed, 1));
      /* Deterministic "vs prior cycle" anchor — kind-specific offset between
       * −3.0 and +4.5 percentage points. */
      const offset = (hashFloat(`prevPass:${kind}`) - 0.4) * 7.5;
      const prevCyclePassRate = clamp(Math.round((passRate - offset) * 10) / 10, 0, 100);
      const deltaPercent = Math.round((passRate - prevCyclePassRate) * 10) / 10;
      return {
        kind,
        labelAr: TEST_KIND_LABEL[kind],
        passed,
        failed,
        pending,
        passRate,
        prevCyclePassRate,
        deltaPercent,
      };
    });

    /* Top 8 governorates by applicant count → rows of the heatmap. */
    const govCounts = new Map<string, number>();
    for (const a of MOCK.applicants) govCounts.set(a.governorate, (govCounts.get(a.governorate) ?? 0) + 1);
    const governorates = Array.from(govCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([gov]) => gov);

    const passRates: number[][] = governorates.map((gov) => {
      const inGov = MOCK.applicants.filter((a) => a.governorate === gov);
      return kinds.map((kind) => {
        let p = 0;
        let f = 0;
        for (const a of inGov) {
          const out = applicantTestOutcome(a.id, kind);
          if (out === 'passed') p += 1;
          else if (out === 'failed') f += 1;
        }
        return pct(p, Math.max(p + f, 1));
      });
    });

    return {
      byKind,
      governorateHeatmap: { governorates, kinds, passRates },
    };
  },

  async getOperationalStatus(): Promise<OperationalStatus> {
    await simulateLatency(180, 320);

    const committees: CommitteeOpStatus[] = MOCK.committees.map((c) => {
      const todayQueue = clamp(Math.round(c.applicants * 0.06 + hashFloat(`q:${c.id}`) * 18), 0, c.applicants);
      const todayProcessed = clamp(
        Math.round(todayQueue * (0.45 + hashFloat(`p:${c.id}`) * 0.45)),
        0,
        todayQueue,
      );
      return {
        id: c.id,
        name: c.name,
        todayQueue,
        todayProcessed,
        signedOffToday: hashFloat(`sign:${c.id}`) > 0.55,
      };
    });

    const medicalStations: MedicalStationOpStatus[] = MOCK.medicalStations
      .map((s) => ({
        id: s.id,
        name: s.name,
        queue: s.queue,
        avgWaitMinutes: Math.round(8 + hashFloat(`wait:${s.id}`) * 22),
      }))
      .sort((a, b) => b.queue - a.queue);

    /* Today's board sessions: pick from MOCK.boardSessions (deterministic order)
     * and re-anchor their times to NOW for "live | scheduled | decided". */
    const sessionPool = (MOCK.boardSessions ?? []).slice(0, 4);
    const boardSessions: BoardSessionOpStatus[] = sessionPool.length
      ? sessionPool.map((s, idx) => ({
          id: s.id,
          label: idx === 0 ? 'الجلسة الصباحية · مراجعة طلبات' : idx === 1 ? 'جلسة استئنافات' : `جلسة ${idx + 1}`,
          scheduledTime: ['09:00', '11:30', '14:00', '16:30'][idx % 4]!,
          state: idx === 0 ? 'live' : idx === 3 ? 'decided' : 'scheduled',
          memberCount: s.attendees?.length ?? 7,
        }))
      : [];

    /* Ongoing exams from MOCK.examConfigs (published). */
    const ongoingExams: OngoingExamStatus[] = (MOCK.examConfigs ?? [])
      .filter((e) => e.status === 'published')
      .map((e) => {
        const sessions = (MOCK.liveExamSessions ?? []).filter((s) => s.examId === e.id || true);
        const taking = sessions.filter((s) => s.status === 'in-progress' || s.status === 'started');
        const dropped = sessions.filter((s) => s.status === 'dropped').length;
        const totalQ = sessions[0]?.totalQuestions ?? 50;
        const avgAnswered =
          taking.length > 0 ? taking.reduce((sum, s) => sum + s.questionsAnswered, 0) / taking.length : 0;
        return {
          id: e.id,
          name: e.nameAr,
          startedTime: '09:30',
          takingCount: taking.length,
          avgCompletionPercent: Math.round((avgAnswered / Math.max(totalQ, 1)) * 100),
          abandonedCount: dropped,
        };
      });

    return { committees, medicalStations, boardSessions, ongoingExams };
  },

  async getGovernanceReport(): Promise<GovernanceReport> {
    await simulateLatency(180, 320);

    /* Hour-of-day buckets — bucket every audit entry deterministically by id
     * hash so reloads produce identical numbers. */
    const hourly: AuditHourBucket[] = Array.from({ length: 24 }, (_, h) => ({
      label: String(h).padStart(2, '0'),
      total: 0,
      highSensitivity: 0,
    }));
    for (const e of MOCK.audit) {
      const hour = hashInt(`${e.id}:hr`, 24);
      const bucket = hourly[hour]!;
      bucket.total += 1;
      if (HIGH_SENSITIVITY_PATTERNS.some((p) => e.details.includes(p))) {
        bucket.highSensitivity += 1;
      }
    }

    const totalLast24h = hourly.reduce((s, b) => s + b.total, 0);
    const highSensitivityLast24h = hourly.reduce((s, b) => s + b.highSensitivity, 0);

    /* Anomaly heuristics — surface up to 5 from MOCK.audit. */
    const anomalies: AnomalySignal[] = [];
    for (const e of MOCK.audit) {
      if (anomalies.length >= 5) break;
      const isApproved = e.action === 'update' && hashFloat(`approved:${e.id}`) > 0.85;
      const isOffHoursRefund = e.details.includes('بدل فاقد') && hashFloat(`oh:${e.id}`) > 0.78;
      const isMultiOverride =
        e.action === 'applicant.transition' && hashFloat(`mov:${e.id}`) > 0.88;

      let reason: string | null = null;
      if (isApproved) reason = 'تعديل سجل بعد الاعتماد';
      else if (isOffHoursRefund) reason = 'إصدار بدل خارج ساعات العمل';
      else if (isMultiOverride) reason = 'تجاوزات متكررة على نفس الملف';
      if (!reason) continue;

      anomalies.push({
        id: e.id,
        timestamp: NOW_MS - hashInt(`${e.id}:ago`, 12) * HOUR_MS,
        actor: e.userName,
        actionLabel: e.actionLabel,
        applicantId: e.entity === 'applicant' ? e.entityId : undefined,
        detail: e.details,
        reason,
      });
    }

    return { hourly, anomalies, totalLast24h, highSensitivityLast24h };
  },

  async getIntegrationStatus(): Promise<IntegrationStatus[]> {
    await simulateLatency(120, 220);
    /* Static deterministic list — no MOCK.integrations seed exists yet. */
    const items: { key: string; nameAr: string; status: 'healthy' | 'degraded' | 'down'; ago: number; calls: number }[] = [
      { key: 'moe', nameAr: 'وزارة التربية والتعليم', status: 'healthy', ago: 4, calls: 1843 },
      { key: 'azhar', nameAr: 'الأزهر الشريف', status: 'healthy', ago: 7, calls: 612 },
      { key: 'payment', nameAr: 'بوابة الدفع الإلكتروني', status: 'degraded', ago: 18, calls: 924 },
      { key: 'nid', nameAr: 'التحقق من الرقم القومي', status: 'healthy', ago: 2, calls: 2710 },
      { key: 'moipass', nameAr: 'منصة MOIPASS', status: 'healthy', ago: 1, calls: 86 },
    ];
    return items.map((i) => ({
      key: i.key,
      nameAr: i.nameAr,
      status: i.status,
      lastCallRelative: i.ago < 60 ? `منذ ${i.ago} دقيقة` : `منذ ${Math.round(i.ago / 60)} ساعة`,
      callsToday: i.calls,
    }));
  },
};
