/**
 * Biometric API — registration, inquiry, verification, gate logs, reports.
 *
 * INTEGRATION CONTRACT (backend default; mock fallback when VITE_USE_MOCKS=true):
 *   GET    /api/biometric/applicants/search?field=&q=                 → BiometricApplicantLookup[]
 *   GET    /api/biometric/applicants/lookup?applicantId=&nationalId=&barcode= → BiometricApplicantLookup | 404
 *   POST   /api/biometric/enroll                                      → BiometricEnrollmentRecord
 *   POST   /api/biometric/verify                                      → VerifyResult
 *   POST   /api/biometric/gate-log                                    → GateLog
 *   GET    /api/biometric/verifications?module=&failedOnly=           → VerificationLog[]
 *   GET    /api/biometric/gate-logs                                   → GateLog[]
 *   GET    /api/biometric/audit                                       → BiometricAuditLog[]
 *   GET    /api/biometric/reports                                     → BiometricReports
 *   GET    /api/biometric/monitoring                                  → { last24h, perStation, recentFailures }
 *
 * The capture/match steps run behind the backend's IBiometricDeviceGateway —
 * simulated by default, real device via the Biometric:Mode flag (BRD §8).
 */

import { apiClient, isBackendEnabled } from '@/shared/lib/api-client';
import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { Applicant, BiometricEnrollment, BiometricVerification } from '@/shared/types/domain';

export type SearchField = 'barcode' | 'nationalId' | 'name' | 'applicantNumber';
export type VerificationMethod = 'face' | 'fingerprint' | 'barcode';
export type VerificationModule = 'security-gate' | 'exam-committee' | 'admissions-committee' | 'medical-commission';
export type VerificationStatus = 'match' | 'no_match' | 'not_enrolled' | 'manual_review_required';
export type EnrollmentStatus = 'enrolled' | 'partial' | 'not_enrolled';
export type GateDirection = 'entry' | 'exit';
export type ExportFormat = 'pdf' | 'excel' | 'word';
export type BiometricAuditAction =
  | 'enrollment'
  | 're_enrollment'
  | 'verification'
  | 'failed_verification'
  | 'manual_review'
  | 'gate_entry'
  | 'gate_exit';

export interface BiometricApplicantLookup {
  applicant: Applicant;
  barcode: string;
  cycleId: string;
  currentExam: string;
  committee: string;
  admissionStatus: Applicant['status'];
  enrollmentStatus: EnrollmentStatus;
  enrollment?: BiometricEnrollment;
  canProceed: boolean;
  blockedReason?: string;
}

export interface EnrollInput {
  applicantId: string;
  nationalId: string;
  barcode: string;
  cycleId: string;
  userId: string;
  retake?: boolean;
  faceCaptured: boolean;
  fingerprintCaptured: boolean;
}

export interface BiometricEnrollmentRecord extends BiometricEnrollment {
  nationalId: string;
  barcode: string;
  cycleId: string;
  enrolledBy: string;
  status: EnrollmentStatus;
  retake: boolean;
}

export interface VerifyInput {
  applicantId?: string;
  nationalId?: string;
  barcode?: string;
  method: VerificationMethod;
  module: VerificationModule;
  operator: string;
}

export interface VerifyResult {
  status: VerificationStatus;
  ok: boolean;
  reason?: string;
  matchScore?: number;
  applicant?: BiometricApplicantLookup;
  timestamp: number;
  canContinue: boolean;
}

export interface VerificationLog {
  id: string;
  applicantId: string;
  applicantName: string;
  method: VerificationMethod;
  result: VerificationStatus;
  operator: string;
  module: VerificationModule;
  timestamp: number;
  confidence?: number;
}

export interface GateLog {
  id: string;
  applicantId: string;
  applicantName: string;
  direction: GateDirection;
  at: number;
  verificationResult: VerificationStatus;
  operator: string;
}

export interface BiometricReports {
  daily: Array<{ label: string; total: number; matched: number; failed: number }>;
  failed: VerificationLog[];
  attendance: GateLog[];
  enrollment: Array<{ label: string; value: number }>;
}

export interface BiometricAuditLog {
  id: string;
  user: string;
  timestamp: number;
  applicantId: string;
  applicantName: string;
  action: BiometricAuditAction;
  result: VerificationStatus | EnrollmentStatus | GateDirection;
}

const ENROLL_STATE: BiometricEnrollmentRecord[] = MOCK.biometricEnrollments.map((e) => {
  const applicant = MOCK.applicants.find((a) => a.id === e.applicantId);
  const barcode = MOCK.barcodes.find((b) => b.applicantId === e.applicantId);
  const status: EnrollmentStatus = e.faceCaptured && e.fingerprintCaptured
    ? 'enrolled'
    : e.faceCaptured || e.fingerprintCaptured
      ? 'partial'
      : 'not_enrolled';

  return {
    ...e,
    nationalId: applicant?.nationalId ?? '',
    barcode: barcode?.code ?? e.applicantId,
    cycleId: barcode?.cycleId ?? 'CYC-2026-M',
    enrolledBy: 'U-006',
    status,
    retake: false,
  };
});

const VERIFY_STATE: VerificationLog[] = MOCK.biometricVerifications.map((v) => {
  const applicant = MOCK.applicants.find((a) => a.id === v.applicantId);
  return {
    id: v.id,
    applicantId: v.applicantId,
    applicantName: applicant?.name ?? 'متقدم غير معروف',
    method: v.method,
    result: v.match ? 'match' : 'manual_review_required',
    operator: 'U-006',
    module: v.station === 'gate' ? 'security-gate' : v.station === 'exam-room' ? 'exam-committee' : 'admissions-committee',
    timestamp: v.ts,
    confidence: v.confidence,
  };
});

const GATE_STATE: GateLog[] = MOCK.barcodeScans
  .filter((s) => s.action === 'gate-in' || s.action === 'gate-out')
  .slice(0, 80)
  .map((s) => {
    const applicant = MOCK.applicants.find((a) => a.id === s.applicantId);
    return {
      id: s.id,
      applicantId: s.applicantId,
      applicantName: applicant?.name ?? 'متقدم غير معروف',
      direction: s.action === 'gate-in' ? 'entry' : 'exit',
      at: s.ts,
      verificationResult: 'match',
      operator: s.scannedBy,
    };
  });

const AUDIT_STATE: BiometricAuditLog[] = VERIFY_STATE.slice(0, 60).map((v) => ({
  id: `BIO-AUD-${v.id}`,
  user: v.operator,
  timestamp: v.timestamp,
  applicantId: v.applicantId,
  applicantName: v.applicantName,
  action: v.result === 'match' ? 'verification' : v.result === 'manual_review_required' ? 'manual_review' : 'failed_verification',
  result: v.result,
}));

let enrollId = ENROLL_STATE.length + 1;
let verifyId = VERIFY_STATE.length + 1;
let gateId = GATE_STATE.length + 1;
let auditId = AUDIT_STATE.length + 1;

function getBarcode(applicantId: string): string {
  return MOCK.barcodes.find((b) => b.applicantId === applicantId)?.code ?? applicantId;
}

function getCurrentExam(applicantId: string): string {
  const scheduled = MOCK.testSchedules.find((t) => t.applicantId === applicantId);
  return scheduled?.kind ?? 'كشف الهيئة والتحقق من الحضور';
}

function lookupFromApplicant(applicant: Applicant): BiometricApplicantLookup {
  const enrollment = ENROLL_STATE.find((e) => e.applicantId === applicant.id);
  const enrollmentStatus: EnrollmentStatus = enrollment?.status ?? 'not_enrolled';
  const isStopped = applicant.status === 'rejected' || applicant.status === 'on-hold';
  const hasCommittee = Boolean(applicant.committee);

  return {
    applicant,
    barcode: getBarcode(applicant.id),
    cycleId: enrollment?.cycleId ?? 'CYC-2026-M',
    currentExam: getCurrentExam(applicant.id),
    committee: applicant.committee,
    admissionStatus: applicant.status,
    enrollmentStatus,
    ...(enrollment ? { enrollment } : {}),
    canProceed: !isStopped && hasCommittee,
    ...(isStopped ? { blockedReason: 'المتقدم موقوف أو غير مستوفٍ ولا يسمح باستكمال الاختبار' } : {}),
  };
}

function findApplicant(input: { applicantId?: string; nationalId?: string; barcode?: string }): Applicant | null {
  if (input.applicantId) {
    return MOCK.applicants.find((a) => a.id === input.applicantId) ?? null;
  }
  if (input.nationalId) {
    return MOCK.applicants.find((a) => a.nationalId === input.nationalId) ?? null;
  }
  if (input.barcode) {
    const barcode = MOCK.barcodes.find((b) => b.code === input.barcode || b.applicantId === input.barcode);
    return MOCK.applicants.find((a) => a.id === barcode?.applicantId || a.id === input.barcode) ?? null;
  }
  return null;
}

function mapStatusToStation(module: VerificationModule): BiometricVerification['station'] {
  if (module === 'security-gate') return 'gate';
  if (module === 'exam-committee') return 'exam-room';
  return 'committee';
}

function pushAudit(input: Omit<BiometricAuditLog, 'id'>): void {
  AUDIT_STATE.unshift({
    id: `BIO-AUD-${String(auditId++).padStart(5, '0')}`,
    ...input,
  });
}

export const biometricService = {
  async searchApplicants(input: { field: SearchField; query: string }): Promise<BiometricApplicantLookup[]> {
    if (isBackendEnabled()) {
      return apiClient.get<BiometricApplicantLookup[]>('/api/biometric/applicants/search', {
        query: { field: input.field, q: input.query },
      });
    }
    await simulateLatency(250, 500);
    const q = input.query.trim().toLowerCase();
    if (!q) return MOCK.applicants.slice(0, 12).map(lookupFromApplicant);

    return MOCK.applicants
      .filter((applicant) => {
        if (input.field === 'nationalId') return applicant.nationalId.includes(q);
        if (input.field === 'name') return applicant.name.toLowerCase().includes(q);
        if (input.field === 'applicantNumber') return applicant.id.toLowerCase().includes(q);
        return getBarcode(applicant.id).toLowerCase().includes(q) || applicant.id.toLowerCase().includes(q);
      })
      .slice(0, 25)
      .map(lookupFromApplicant);
  },

  async getApplicant(input: { applicantId?: string; nationalId?: string; barcode?: string }): Promise<BiometricApplicantLookup | null> {
    if (isBackendEnabled()) {
      try {
        return await apiClient.get<BiometricApplicantLookup>('/api/biometric/applicants/lookup', {
          query: { applicantId: input.applicantId, nationalId: input.nationalId, barcode: input.barcode },
        });
      } catch {
        return null;
      }
    }
    await simulateLatency(200, 420);
    const applicant = findApplicant(input);
    return applicant ? lookupFromApplicant(applicant) : null;
  },

  async enroll(input: EnrollInput): Promise<BiometricEnrollmentRecord> {
    if (isBackendEnabled()) {
      return apiClient.post<BiometricEnrollmentRecord>('/api/biometric/enroll', input);
    }
    await simulateLatency(600, 1100);
    const status: EnrollmentStatus = input.faceCaptured && input.fingerprintCaptured
      ? 'enrolled'
      : input.faceCaptured || input.fingerprintCaptured
        ? 'partial'
        : 'not_enrolled';
    const next: BiometricEnrollmentRecord = {
      id: `BIO-${String(enrollId++).padStart(5, '0')}`,
      applicantId: input.applicantId,
      nationalId: input.nationalId,
      barcode: input.barcode,
      cycleId: input.cycleId,
      enrolledAt: Date.now(),
      enrolledBy: input.userId,
      faceCaptured: input.faceCaptured,
      fingerprintCaptured: input.fingerprintCaptured,
      livenessConfirmed: input.faceCaptured,
      templateRef: `tmpl/${input.cycleId}/${input.applicantId}`,
      status,
      retake: Boolean(input.retake),
    };

    ENROLL_STATE.unshift(next);
    pushAudit({
      user: input.userId,
      timestamp: next.enrolledAt,
      applicantId: input.applicantId,
      applicantName: findApplicant({ applicantId: input.applicantId })?.name ?? 'متقدم غير معروف',
      action: input.retake ? 're_enrollment' : 'enrollment',
      result: status,
    });
    VERIFY_STATE.unshift({
      id: `VER-${String(verifyId++).padStart(5, '0')}`,
      applicantId: input.applicantId,
      applicantName: findApplicant({ applicantId: input.applicantId })?.name ?? 'متقدم غير معروف',
      method: 'fingerprint',
      result: status === 'enrolled' ? 'match' : 'manual_review_required',
      operator: input.userId,
      module: 'admissions-committee',
      timestamp: next.enrolledAt,
      confidence: status === 'enrolled' ? 98 : 65,
    });
    return next;
  },

  async verify(input: VerifyInput): Promise<VerifyResult> {
    if (isBackendEnabled()) {
      return apiClient.post<VerifyResult>('/api/biometric/verify', input);
    }
    await simulateLatency(500, 900);
    const applicant = findApplicant(input);
    const timestamp = Date.now();
    if (!applicant) {
      return {
        status: 'no_match',
        ok: false,
        reason: 'لم يتم العثور على المتقدم',
        timestamp,
        canContinue: false,
      };
    }

    const lookup = lookupFromApplicant(applicant);
    let status: VerificationStatus;
    let confidence: number | undefined;
    let reason: string | undefined;

    if (lookup.enrollmentStatus === 'not_enrolled') {
      status = 'not_enrolled';
      reason = 'المتقدم غير مسجل بيومترياً';
    } else if (!lookup.canProceed) {
      status = 'manual_review_required';
      confidence = 70;
      reason = lookup.blockedReason ?? 'تحتاج الحالة إلى مراجعة يدوية';
    } else if (input.method === 'barcode') {
      status = 'match';
      confidence = 100;
    } else {
      const score = 82 + Math.floor(Math.random() * 17);
      confidence = score;
      status = score >= 88 ? 'match' : score >= 76 ? 'manual_review_required' : 'no_match';
      if (status === 'manual_review_required') reason = 'درجة التطابق أقل من حد الاعتماد الآلي';
      if (status === 'no_match') reason = 'فشل التحقق ولا يسمح باستكمال الاختبار';
    }

    VERIFY_STATE.unshift({
      id: `VER-${String(verifyId++).padStart(5, '0')}`,
      applicantId: applicant.id,
      applicantName: applicant.name,
      method: input.method,
      result: status,
      operator: input.operator,
      module: input.module,
      timestamp,
      ...(confidence ? { confidence } : {}),
    });
    pushAudit({
      user: input.operator,
      timestamp,
      applicantId: applicant.id,
      applicantName: applicant.name,
      action: status === 'match' ? 'verification' : status === 'manual_review_required' ? 'manual_review' : 'failed_verification',
      result: status,
    });

    return {
      status,
      ok: status === 'match',
      ...(reason ? { reason } : {}),
      ...(confidence ? { matchScore: confidence / 100 } : {}),
      applicant: lookup,
      timestamp,
      canContinue: status === 'match',
    };
  },

  async recordGateLog(input: {
    applicantId: string;
    direction: GateDirection;
    verificationResult: VerificationStatus;
    operator: string;
  }): Promise<GateLog> {
    if (isBackendEnabled()) {
      return apiClient.post<GateLog>('/api/biometric/gate-log', input);
    }
    await simulateLatency(250, 500);
    const applicant = findApplicant({ applicantId: input.applicantId });
    const next: GateLog = {
      id: `GATE-${String(gateId++).padStart(5, '0')}`,
      applicantId: input.applicantId,
      applicantName: applicant?.name ?? 'متقدم غير معروف',
      direction: input.direction,
      at: Date.now(),
      verificationResult: input.verificationResult,
      operator: input.operator,
    };
    GATE_STATE.unshift(next);
    pushAudit({
      user: input.operator,
      timestamp: next.at,
      applicantId: input.applicantId,
      applicantName: next.applicantName,
      action: input.direction === 'entry' ? 'gate_entry' : 'gate_exit',
      result: input.direction,
    });
    return next;
  },

  async listVerifications(filters: { module?: VerificationModule; failedOnly?: boolean; since?: number } = {}): Promise<VerificationLog[]> {
    if (isBackendEnabled()) {
      return apiClient.get<VerificationLog[]>('/api/biometric/verifications', {
        query: { module: filters.module, failedOnly: filters.failedOnly ? true : undefined },
      });
    }
    await simulateLatency();
    let out = VERIFY_STATE;
    if (filters.module) out = out.filter((v) => v.module === filters.module);
    if (filters.failedOnly) out = out.filter((v) => v.result !== 'match');
    if (filters.since) out = out.filter((v) => v.timestamp >= filters.since!);
    return [...out];
  },

  async listGateLogs(): Promise<GateLog[]> {
    if (isBackendEnabled()) {
      return apiClient.get<GateLog[]>('/api/biometric/gate-logs');
    }
    await simulateLatency();
    return [...GATE_STATE];
  },

  async listAuditLogs(): Promise<BiometricAuditLog[]> {
    if (isBackendEnabled()) {
      return apiClient.get<BiometricAuditLog[]>('/api/biometric/audit');
    }
    await simulateLatency();
    return [...AUDIT_STATE];
  },

  async reports(): Promise<BiometricReports> {
    if (isBackendEnabled()) {
      return apiClient.get<BiometricReports>('/api/biometric/reports');
    }
    await simulateLatency();
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayStart = Date.now() - i * 24 * 3600_000;
      const rows = VERIFY_STATE.filter((v) => Math.abs(v.timestamp - dayStart) < 24 * 3600_000);
      return {
        label: new Date(dayStart).toLocaleDateString('ar-EG', { weekday: 'short' }),
        total: rows.length,
        matched: rows.filter((r) => r.result === 'match').length,
        failed: rows.filter((r) => r.result !== 'match').length,
      };
    }).reverse();

    const enrolled = ENROLL_STATE.filter((e) => e.status === 'enrolled').length;
    const partial = ENROLL_STATE.filter((e) => e.status === 'partial').length;
    const notEnrolled = Math.max(0, MOCK.applicants.length - enrolled - partial);

    return {
      daily: days,
      failed: VERIFY_STATE.filter((v) => v.result !== 'match').slice(0, 50),
      attendance: GATE_STATE.slice(0, 50),
      enrollment: [
        { label: 'مسجل بالكامل', value: enrolled },
        { label: 'تسجيل جزئي', value: partial },
        { label: 'غير مسجل', value: notEnrolled },
      ],
    };
  },

  async exportReport(format: ExportFormat): Promise<{ fileName: string }> {
    await simulateLatency(350, 700);
    return { fileName: `biometric-report.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf'}` };
  },

  async monitoring(): Promise<{
    last24h: { ts: number; count: number }[];
    perStation: Record<string, { total: number; match: number; failed: number }>;
    recentFailures: BiometricVerification[];
  }> {
    if (isBackendEnabled()) {
      return apiClient.get<{
        last24h: { ts: number; count: number }[];
        perStation: Record<string, { total: number; match: number; failed: number }>;
        recentFailures: BiometricVerification[];
      }>('/api/biometric/monitoring');
    }
    await simulateLatency();
    const oneDay = 24 * 3600_000;
    const since = Date.now() - oneDay;
    const recent = VERIFY_STATE.filter((v) => v.timestamp >= since);
    const buckets = new Map<number, number>();
    for (const v of recent) {
      const hour = Math.floor((Date.now() - v.timestamp) / 3600_000);
      buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
    }
    const last24h = Array.from({ length: 24 }, (_, h) => ({ ts: Date.now() - h * 3600_000, count: buckets.get(h) ?? 0 }));
    const perStation: Record<string, { total: number; match: number; failed: number }> = {
      gate: { total: 0, match: 0, failed: 0 },
      'exam-room': { total: 0, match: 0, failed: 0 },
      committee: { total: 0, match: 0, failed: 0 },
    };
    for (const v of recent) {
      const station = mapStatusToStation(v.module);
      perStation[station]!.total += 1;
      if (v.result === 'match') perStation[station]!.match += 1;
      else perStation[station]!.failed += 1;
    }
    const recentFailures: BiometricVerification[] = recent
      .filter((v) => v.result !== 'match')
      .slice(0, 10)
      .map((v) => ({
        id: v.id,
        applicantId: v.applicantId,
        station: mapStatusToStation(v.module),
        ts: v.timestamp,
        method: v.method,
        match: false,
        confidence: v.confidence,
      }));
    return { last24h, perStation, recentFailures };
  },
};
