/**
 * Reports command center — super_admin admissions overview.
 *
 * INTEGRATION CONTRACT:
 *   GET /api/admin/reports/cycle-snapshot
 *   GET /api/admin/reports/funnel
 *   GET /api/admin/reports/by-department
 *   GET /api/admin/reports/test-results
 *   GET /api/admin/reports/operational-status
 *   GET /api/admin/reports/governance
 *   GET /api/admin/reports/integrations
 */

import { apiClient, isBackendEnabled } from '@/shared/lib/api-client';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { MOCK } from '@/shared/mock-data';
import type {
  Applicant,
  ApplicantCategoryKey,
  CycleSnapshot,
  DepartmentReport,
  GovernanceReport,
  IntegrationStatus,
  OperationalStatus,
  StageFunnelPoint,
  TestKindForReport,
  TestResultsReport,
} from '@/shared/types/domain';
import type { Pagination } from '@/shared/types/api';
import type {
  ApplicantReportAggregate,
  ApplicantReportRow,
  DataAvailabilityReport,
  GroupByDimension,
  ReportsExportFormat,
  ReportsExportKind,
  ReportsFilters,
  StageDropoffReport,
} from '../reports/types';

export const NOW = new Date('2026-05-15T10:00:00+02:00');

const TEST_KIND_LABELS: Record<TestKindForReport, string> = {
  medical: 'الكشف الطبي',
  physical: 'اختبار اللياقة',
  psychological: 'الاختبار النفسي',
  interview: 'المقابلة الشخصية',
  drug: 'تحليل المخدرات',
};

const STAGE_LABELS = [
  'رقم الهاتف',
  'رسالة التأكيد',
  'البيانات الشخصية',
  'بيانات المؤهل',
  'الحالة الاجتماعية',
  'سداد الرسوم',
  'بيانات الأسرة',
  'موعد الاختبار',
  'كارت التردد',
  'المتابعة',
  'وثيقة التعارف',
] as const;

const CATEGORY_LABELS: Record<ApplicantCategoryKey, string> = {
  officers_general: 'القسم العام',
  law_bachelor: 'قسم الحقوق',
  physical_education_bachelor: 'قسم التربية الرياضية',
  specialized_officers: 'قسم الضباط المتخصصين',
};

const CATEGORY_KEYS: readonly ApplicantCategoryKey[] = [
  'officers_general',
  'law_bachelor',
  'physical_education_bachelor',
  'specialized_officers',
] as const;

function applicantCategory(applicant: Applicant, index: number): ApplicantCategoryKey {
  if (applicant.department) {
    if (applicant.department === 'lawyers') return 'law_bachelor';
    if (applicant.department === 'masters' || applicant.department === 'doctorate' || applicant.department === 'special') {
      return 'specialized_officers';
    }
  }
  if (applicant.gender === 'female') return 'physical_education_bachelor';
  if (applicant.certType.includes('أزهرية') || index % 7 === 0) return 'law_bachelor';
  if (index % 5 === 0) return 'specialized_officers';
  return 'officers_general';
}

function activeCycle() {
  return MOCK.cycles.find((cycle) => cycle.isActive) ?? MOCK.cycles[0]!;
}

function daysBetween(startIso: string, end: Date): number {
  return Math.max(0, Math.ceil((new Date(end).getTime() - new Date(startIso).getTime()) / 86_400_000));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function percent(part: number, total: number): number {
  return total > 0 ? round1((part / total) * 100) : 0;
}

function buildCycleSnapshot(): CycleSnapshot {
  const cycle = activeCycle();
  const applicants = MOCK.applicants;
  const finalApproved = applicants.filter((a) => a.status === 'approved' || a.results.finalExam === 'pass').length;
  const openDateIso = cycle.openDate;
  const closeDateIso = cycle.closeDate;
  const totalDays = Math.max(14, daysBetween(openDateIso, new Date(closeDateIso)));
  const bucketCount = Math.min(60, totalDays);
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: String(index + 1),
    value: 0,
  }));
  const startMs = new Date(openDateIso).getTime();
  const spanMs = Math.max(1, new Date(closeDateIso).getTime() - startMs);
  for (const applicant of applicants) {
    const ratio = (new Date(applicant.registeredAt).getTime() - startMs) / spanMs;
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * bucketCount)));
    buckets[index]!.value += 1;
  }

  const prevCycle = buckets.map((point, index) => ({
    label: point.label,
    value: Math.max(0, Math.round(point.value * (0.82 + ((index % 5) * 0.035)))),
  }));
  const currentTotal = buckets.reduce((sum, point) => sum + point.value, 0);
  const previousTotal = prevCycle.reduce((sum, point) => sum + point.value, 0);
  const categoriesOpen = CATEGORY_KEYS.map((key) => {
    const category = MOCK.categories.find((row) => row.key === key);
    const config = cycle.openCategories?.[key];
    return {
      key,
      labelAr: category?.labelAr ?? CATEGORY_LABELS[key],
      isOpen: config?.isOpen ?? category?.isOpen ?? true,
      capacity: config?.capacity ?? null,
    };
  });

  return {
    cycleId: cycle.id,
    cycleLabelAr: cycle.nameAr,
    openDateIso,
    closeDateIso,
    hijriCloseDate: '٢٤ شوال ١٤٤٧',
    daysRemaining: daysBetween(NOW.toISOString(), new Date(closeDateIso)),
    capacity: cycle.expectedCapacity ?? null,
    totalApplicants: applicants.length,
    finalApproved,
    acceptanceRate: percent(finalApproved, applicants.length),
    prevCycleAcceptanceRate: 23.4,
    registrationTempo: {
      thisCycle: buckets,
      prevCycle,
      deltaPercent: percent(currentTotal - previousTotal, previousTotal),
    },
    categoriesOpen,
    integrationsHealthy: 5,
    integrationsTotal: 7,
    generatedAt: NOW.toISOString(),
  };
}

function buildStageFunnel(): StageFunnelPoint[] {
  const total = MOCK.applicants.length;
  return STAGE_LABELS.map((label, index) => {
    const count = MOCK.applicants.filter((applicant) => applicant.stage >= index).length;
    const previousCount = index === 0 ? total : MOCK.applicants.filter((applicant) => applicant.stage >= index - 1).length;
    const avgDaysAtStage = round1(1.2 + (index % 4) * 0.9 + (index === 6 ? 3.4 : 0) + (index === 8 ? 2.1 : 0));
    return {
      stageIndex: index,
      stageLabel: label,
      count,
      percentOfTotal: percent(count, total),
      dropOffFromPrevPercent: index === 0 ? 0 : percent(previousCount - count, previousCount),
      avgDaysAtStage,
      isBottleneck: avgDaysAtStage >= 5,
    };
  });
}

function buildDepartmentReport(): DepartmentReport {
  const rows = CATEGORY_KEYS.map((key) => {
    const applicants = MOCK.applicants.filter((applicant, index) => applicantCategory(applicant, index) === key);
    const failed = applicants.filter((applicant) => applicant.status === 'rejected').length;
    const pending = applicants.filter((applicant) => applicant.status === 'pending' || applicant.status === 'under-review').length;
    const passed = Math.max(0, applicants.length - failed - pending);
    return {
      key,
      labelAr: MOCK.categories.find((category) => category.key === key)?.labelAr ?? CATEGORY_LABELS[key],
      total: applicants.length,
      percentOfTotal: percent(applicants.length, MOCK.applicants.length),
      eligibilityPassed: passed,
      eligibilityFailed: failed,
      eligibilityPending: pending,
      eligibilityPassRate: percent(passed, applicants.length),
    };
  });
  return {
    byDepartment: rows,
    topRejectionReasons: [
      { reason: 'age_out_of_range', labelAr: 'تجاوز الحد الأقصى للسن', count: 126, percent: 31 },
      { reason: 'score_below_min', labelAr: 'المجموع أقل من الحد الأدنى', count: 102, percent: 25 },
      { reason: 'qualification_mismatch', labelAr: 'المؤهل غير مطابق للشروط', count: 87, percent: 21 },
      { reason: 'data_not_found', labelAr: 'مستندات غير مكتملة', count: 58, percent: 14 },
      { reason: 'nid_already_used', labelAr: 'تكرار الرقم القومي داخل الدورة', count: 34, percent: 9 },
    ],
  };
}

function buildTestResultsReport(): TestResultsReport {
  const specs: Array<{ kind: TestKindForReport; selector: keyof Applicant['results'] }> = [
    { kind: 'medical', selector: 'medical' },
    { kind: 'physical', selector: 'fitness' },
    { kind: 'psychological', selector: 'interview' },
    { kind: 'interview', selector: 'interview' },
    { kind: 'drug', selector: 'finalExam' },
  ];
  const byKind = specs.map(({ kind, selector }, index) => {
    const passed = MOCK.applicants.filter((applicant) => applicant.results[selector] === 'pass').length;
    const failed = MOCK.applicants.filter((applicant) => applicant.results[selector] === 'fail').length;
    const pending = MOCK.applicants.length - passed - failed;
    return {
      kind,
      labelAr: TEST_KIND_LABELS[kind],
      passed,
      failed,
      pending,
      passRate: percent(passed, passed + failed),
      prevCyclePassRate: round1(66 + index * 2.4),
      deltaPercent: round1(percent(passed, passed + failed) - (66 + index * 2.4)),
    };
  });
  const governorates = [...MOCK.governorates]
    .sort((a, b) => MOCK.applicants.filter((x) => x.governorate === b).length - MOCK.applicants.filter((x) => x.governorate === a).length)
    .slice(0, 8);
  return {
    byKind,
    governorateHeatmap: {
      governorates,
      kinds: specs.map((spec) => spec.kind),
      passRates: governorates.map((_, rowIndex) =>
        specs.map((_, colIndex) => Math.max(42, Math.min(96, round1(63 + rowIndex * 2.7 - colIndex * 3.2 + ((rowIndex + colIndex) % 4) * 4)))),
      ),
    },
  };
}

function buildOperationalStatus(): OperationalStatus {
  return {
    committees: MOCK.committeeInstances.slice(0, 6).map((committee, index) => {
      const todayQueue = 35 + index * 12 + (index === 2 ? 42 : 0);
      return {
        id: committee.id,
        name: `لجنة ${committee.definitionCode}`,
        todayQueue,
        todayProcessed: Math.max(8, Math.round(todayQueue * (0.48 + (index % 3) * 0.12))),
        signedOffToday: index % 3 !== 1,
      };
    }),
    medicalStations: MOCK.medicalStations.map((station, index) => ({
      id: station.id,
      name: station.name,
      queue: station.queue,
      avgWaitMinutes: 18 + index * 5 + (station.queue > 35 ? 12 : 0),
    })),
    boardSessions: MOCK.boardSessions.slice(0, 3).map((session, index) => ({
      id: session.id,
      label: `جلسة الهيئة ${session.id}`,
      scheduledTime: session.time,
      state: index === 0 ? 'live' : index === 1 ? 'scheduled' : 'decided',
      memberCount: session.attendees.length,
    })),
    ongoingExams: MOCK.liveExamSessions.slice(0, 3).map((session) => ({
      id: session.id,
      name: `اختبار ${session.examId}`,
      startedTime: session.startedAt
        ? new Date(session.startedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        : 'لم يبدأ',
      takingCount: session.status === 'in-progress' ? 1 : 0,
      avgCompletionPercent: Math.round((session.questionsAnswered / Math.max(1, session.totalQuestions)) * 100),
      abandonedCount: session.status === 'dropped' ? 1 : 0,
    })),
  };
}

function buildGovernanceReport(): GovernanceReport {
  const hourly = Array.from({ length: 24 }, (_, index) => {
    const total = MOCK.audit.filter((entry) => new Date(entry.timestamp).getHours() === index).length;
    return {
      label: String(index).padStart(2, '0'),
      total,
      highSensitivity: MOCK.audit.filter((entry) => new Date(entry.timestamp).getHours() === index && ['delete', 'soft_delete', 'restore', 'export', 'user_roles_changed'].includes(entry.action)).length,
    };
  });
  const anomalies = MOCK.audit
    .filter((entry) => ['delete', 'soft_delete', 'restore', 'export', 'login_failed', 'account_locked', 'user_roles_changed'].includes(entry.action))
    .slice(0, 5)
    .map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      actor: entry.userName,
      actionLabel: entry.actionLabel,
      applicantId: entry.entityType === 'applicant' ? entry.entityId : undefined,
      detail: entry.details,
      reason: entry.action === 'export' ? 'تصدير واسع النطاق' : entry.action.includes('login') ? 'محاولة دخول غير معتادة' : 'عملية حساسة',
    }));

  return {
    hourly,
    anomalies,
    totalLast24h: hourly.reduce((sum, point) => sum + point.total, 0),
    highSensitivityLast24h: hourly.reduce((sum, point) => sum + point.highSensitivity, 0),
  };
}

function buildIntegrationStatus(): IntegrationStatus[] {
  return [
    { key: 'sms', nameAr: 'بوابة الرسائل القصيرة', status: 'healthy', lastCallRelative: 'قبل دقيقتين', callsToday: 824 },
    { key: 'fawry', nameAr: 'فوري للمدفوعات', status: 'degraded', lastCallRelative: 'قبل ١١ دقيقة', callsToday: MOCK.adminPayments.length },
    { key: 'nid', nameAr: 'استعلام الرقم القومي', status: 'healthy', lastCallRelative: 'قبل دقيقة', callsToday: 146 },
    { key: 'barcode', nameAr: 'بوابة الباركود', status: 'healthy', lastCallRelative: 'قبل ٤ دقائق', callsToday: MOCK.barcodeScans.length },
    { key: 'biometric', nameAr: 'التحقق الحيوي', status: 'healthy', lastCallRelative: 'قبل ٣ دقائق', callsToday: MOCK.biometricVerifications.length },
    { key: 'mail', nameAr: 'خدمة البريد الداخلي', status: 'down', lastCallRelative: 'قبل ٤٢ دقيقة', callsToday: 37 },
    { key: 'jobs', nameAr: 'مهام التقارير الليلية', status: 'healthy', lastCallRelative: 'قبل ٦ ساعات', callsToday: 9 },
  ];
}

async function mock<T>(factory: () => T): Promise<T> {
  await simulateLatency(120, 260);
  return factory();
}

function reportsQuery(filters: ReportsFilters = {}): Record<string, string | number | undefined> {
  return {
    cycleId: filters.cycleId,
    dateFrom: filters.dateRange?.from,
    dateTo: filters.dateRange?.to,
    ageMin: filters.ageMin,
    ageMax: filters.ageMax,
    categoryKey: filters.categoryKey,
    applicantType: filters.applicantType,
    gender: filters.gender,
    committeeId: filters.committeeId === 'all' ? undefined : filters.committeeId,
    specializationCode: filters.specializationCode,
    paymentStatus: filters.paymentStatus,
    stoppedAtStage: filters.stoppedAtStage,
  };
}

export const reportsService = {
  async getCycleSnapshot(): Promise<CycleSnapshot> {
    if (!isBackendEnabled()) return mock(buildCycleSnapshot);
    return apiClient.get('/api/admin/reports/cycle-snapshot');
  },

  async getStageFunnel(): Promise<StageFunnelPoint[]> {
    if (!isBackendEnabled()) return mock(buildStageFunnel);
    return apiClient.get('/api/admin/reports/funnel');
  },

  async getDepartmentReport(): Promise<DepartmentReport> {
    if (!isBackendEnabled()) return mock(buildDepartmentReport);
    return apiClient.get('/api/admin/reports/by-department');
  },

  async getTestResultsReport(): Promise<TestResultsReport> {
    if (!isBackendEnabled()) return mock(buildTestResultsReport);
    return apiClient.get('/api/admin/reports/test-results');
  },

  async getOperationalStatus(): Promise<OperationalStatus> {
    if (!isBackendEnabled()) return mock(buildOperationalStatus);
    return apiClient.get('/api/admin/reports/operational-status');
  },

  async getGovernanceReport(): Promise<GovernanceReport> {
    if (!isBackendEnabled()) return mock(buildGovernanceReport);
    return apiClient.get('/api/admin/reports/governance');
  },

  async getIntegrationStatus(): Promise<IntegrationStatus[]> {
    if (!isBackendEnabled()) return mock(buildIntegrationStatus);
    return apiClient.get('/api/admin/reports/integrations');
  },

  /**
   * INTEGRATION CONTRACT:
   *   GET /api/admin/reports/applicants/aggregate
   *   Permission: reports:read
   *   Query: cycleId, dateFrom, dateTo, ageMin, ageMax, categoryKey,
   *   applicantType, gender, committeeId, specializationCode,
   *   paymentStatus, groupBy.
   */
  async getApplicantsAggregate(
    filters: ReportsFilters,
    groupBy: GroupByDimension,
  ): Promise<ApplicantReportAggregate> {
    return apiClient.get('/api/admin/reports/applicants/aggregate', {
      query: { ...reportsQuery(filters), groupBy },
    });
  },

  /**
   * INTEGRATION CONTRACT:
   *   GET /api/admin/reports/applicants/detail
   *   Permission: reports:read
   *   Query: all report filters plus page, pageSize, sort.
   *   Response: Page<ApplicantReportRow>.
   */
  async getApplicantsDetail(
    filters: ReportsFilters,
    opts: { page: number; pageSize: number; sort?: string; search?: string },
  ): Promise<Pagination<ApplicantReportRow>> {
    return apiClient.get('/api/admin/reports/applicants/detail', {
      query: { ...reportsQuery(filters), ...opts },
    });
  },

  /**
   * INTEGRATION CONTRACT:
   *   GET /api/admin/reports/stage-dropoff
   *   Permission: reports:read
   *   Query: all report filters plus stoppedAtStage and staleDays.
   *   Response: Page<StuckApplicantRow> + funnel.
   */
  async getStageDropoff(
    filters: ReportsFilters,
    opts: { page: number; pageSize: number; staleDays: number },
  ): Promise<StageDropoffReport> {
    return apiClient.get('/api/admin/reports/stage-dropoff', {
      query: { ...reportsQuery(filters), ...opts },
    });
  },

  /**
   * INTEGRATION CONTRACT:
   *   GET /api/admin/reports/data-availability
   *   Permission: reports:read
   *   Query: every report filter.
   */
  async getDataAvailability(filters: ReportsFilters): Promise<DataAvailabilityReport> {
    return apiClient.get('/api/admin/reports/data-availability', {
      query: reportsQuery(filters),
    });
  },

  /**
   * INTEGRATION CONTRACT:
   *   POST /api/admin/reports/export
   *   Permission: reports:export
   *   Body: filters + format + report.
   *   Response: Blob with Content-Disposition filename.
   */
  async exportReport(payload: {
    filters: ReportsFilters;
    format: ReportsExportFormat;
    report: ReportsExportKind;
    title: string;
  }): Promise<Blob> {
    return apiClient.post('/api/admin/reports/export', payload, { responseType: 'blob' });
  },
};
