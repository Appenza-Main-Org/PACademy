/**
 * Biometric API — registration, inquiry, verification, gate logs, reports.
 *
 * INTEGRATION CONTRACT (backend default; mock fallback when VITE_USE_MOCKS=true):
 *   GET    /api/biometric/applicants/search?field=&q=                 → BiometricApplicantLookup[]
 *   GET    /api/biometric/applicants/lookup?applicantId=&nationalId=&barcode= → BiometricApplicantLookup | 404
 *   POST   /api/biometric/enroll                                      → BiometricEnrollmentRecord
 *   POST   /api/biometric/enroll/link-previous                        → BiometricEnrollmentRecord
 *   POST   /api/biometric/verify                                      → VerifyResult
 *   POST   /api/biometric/gate-log                                    → GateLog
 *   GET    /api/biometric/verifications?module=&failedOnly=           → VerificationLog[]
 *   GET    /api/biometric/gate-logs                                   → GateLog[]
 *   GET    /api/biometric/audit                                       → BiometricAuditLog[]
 *   GET    /api/biometric/reports                                     → BiometricReports
 *   GET    /api/biometric/presence                                    → BiometricPresence
 *   GET    /api/biometric/monitoring                                  → { last24h, perStation, recentFailures }
 *
 * The capture/match steps run behind the backend's IBiometricDeviceGateway —
 * simulated by default, real device via the Biometric:Mode flag (BRD §8).
 */

import { apiClient, isBackendEnabled } from '@/shared/lib/api-client';
import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { Applicant, BiometricEnrollment } from '@/shared/types/domain';

export type SearchField = 'barcode' | 'nationalId' | 'name' | 'applicantNumber';
export type VerificationMethod = 'face' | 'fingerprint' | 'barcode';
export type VerificationModule = 'security-gate' | 'exam-committee' | 'admissions-committee' | 'medical-commission' | 'medical-clinic';
export type VerificationStatus = 'match' | 'no_match' | 'not_enrolled' | 'manual_review_required';
export type EnrollmentStatus = 'enrolled' | 'partial' | 'not_enrolled';
export type GateDirection = 'entry' | 'exit';
export type ExportFormat = 'pdf' | 'excel' | 'word';
export type BiometricAlertCode = 'NOT_REGISTERED' | 'EXAM_DATE_MISMATCH' | 'COMMITTEE_MISMATCH';
export type BiometricAuditAction =
  | 'enrollment'
  | 're_enrollment'
  | 'link_previous'
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
  currentExamDate: string;
  currentExamResult: string;
  committee: string;
  admissionStatus: Applicant['status'];
  enrollmentStatus: EnrollmentStatus;
  enrollment?: BiometricEnrollment;
  academyVisitCount: number;
  studentCommitteeVisitCount: number;
  examCommitteeVisitCount: number;
  medicalCommitteeVisitCount: number;
  clinicVisitCount: number;
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
  fingerprintCount?: number;
}

export interface BiometricEnrollmentRecord extends BiometricEnrollment {
  nationalId: string;
  barcode: string;
  cycleId: string;
  enrolledBy: string;
  status: EnrollmentStatus;
  retake: boolean;
  fingerprintCount?: number;
  fingerprintTemplates?: Array<{ finger: number; templateRef: string; quality: number }>;
  faceTemplateRef?: string | null;
  linkedFromEnrollmentId?: string;
  linkedFromCycleId?: string;
  source?: 'live_capture' | 'retake' | 'linked_previous';
}

export interface VerifyInput {
  applicantId?: string;
  nationalId?: string;
  barcode?: string;
  /** Optional — when omitted the modality is auto-detected from the punch. */
  method?: VerificationMethod;
  module: VerificationModule;
  operator: string;
  stationCommittee?: string;
  today?: string;
  /** Restrict the device match to punches from this terminal (serial). */
  terminalSn?: string;
}

export interface VerifyResult {
  status: VerificationStatus;
  ok: boolean;
  reason?: string;
  matchScore?: number;
  applicant?: BiometricApplicantLookup;
  timestamp: number;
  canContinue: boolean;
  alertCodes?: BiometricAlertCode[];
  voiceAlerts?: string[];
  /** Provenance of the device punch that drove a listen-and-verify (verify-live). */
  found?: boolean;
  identifiedName?: string | null;
  identifiedEmpCode?: string | null;
  identifiedDeviceEmpId?: number | null;
  identifiedAreaName?: string | null;
  identifiedTerminalSn?: string | null;
  identifiedTerminalAlias?: string | null;
  identifiedUploadTime?: string | null;
  identifiedVerifyType?: number | null;
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
  registeredAttendance: GateLog[];
  insideCommittees: Array<{ committee: string; count: number; applicants?: Array<{ applicantId: string; applicantName: string; enteredAt: number }> }>;
  enrollment: Array<{ label: string; value: number }>;
}

export interface BiometricPresence {
  totalInside: number;
  byCommittee: Array<{ committee: string; count: number; applicants: Array<{ applicantId: string; applicantName: string; enteredAt: number }> }>;
  rows: GateLog[];
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

function getCurrentExamDate(applicantId: string): string {
  const scheduled = MOCK.testSchedules.find((t) => t.applicantId === applicantId);
  return scheduled?.scheduledAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

function getCurrentExamResult(applicant: Applicant): string {
  if (applicant.results.interview === 'pass') return 'ناجح';
  if (applicant.results.interview === 'fail') return 'راسب';
  return 'لم تظهر';
}

function countVerifications(applicantId: string, module: VerificationModule): number {
  return VERIFY_STATE.filter((v) => v.applicantId === applicantId && v.module === module).length;
}

function countGateVisits(applicantId: string): number {
  return GATE_STATE.filter((g) => g.applicantId === applicantId && g.direction === 'entry').length;
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
    currentExamDate: getCurrentExamDate(applicant.id),
    currentExamResult: getCurrentExamResult(applicant),
    committee: applicant.committee,
    admissionStatus: applicant.status,
    enrollmentStatus,
    ...(enrollment ? { enrollment } : {}),
    academyVisitCount: countGateVisits(applicant.id),
    studentCommitteeVisitCount: countVerifications(applicant.id, 'admissions-committee'),
    examCommitteeVisitCount: countVerifications(applicant.id, 'exam-committee'),
    medicalCommitteeVisitCount: countVerifications(applicant.id, 'medical-commission'),
    clinicVisitCount: countVerifications(applicant.id, 'medical-clinic'),
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

function mapStatusToStation(module: VerificationModule): string {
  if (module === 'security-gate') return 'gate';
  if (module === 'exam-committee') return 'exam-room';
  if (module === 'medical-commission') return 'medical-commission';
  if (module === 'medical-clinic') return 'medical-clinic';
  return 'committee';
}

function buildPresence(): BiometricPresence {
  const latest = new Map<string, GateLog>();
  for (const row of GATE_STATE) {
    if (!latest.has(row.applicantId)) latest.set(row.applicantId, row);
  }
  const rows = [...latest.values()].filter((row) => row.direction === 'entry');
  const grouped = new Map<string, GateLog[]>();
  for (const row of rows) {
    const applicant = MOCK.applicants.find((a) => a.id === row.applicantId);
    const key = applicant?.committee ?? 'غير محدد';
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return {
    totalInside: rows.length,
    rows,
    byCommittee: [...grouped.entries()].map(([committee, list]) => ({
      committee,
      count: list.length,
      applicants: list.map((row) => ({ applicantId: row.applicantId, applicantName: row.applicantName, enteredAt: row.at })),
    })),
  };
}

function pushAudit(input: Omit<BiometricAuditLog, 'id'>): void {
  AUDIT_STATE.unshift({
    id: `BIO-AUD-${String(auditId++).padStart(5, '0')}`,
    ...input,
  });
}

/** A registered terminal as returned by the ZKBioTime device directory. */
export interface ZkDevice {
  id: number;
  sn: string;
  alias?: string;
  terminal_name?: string;
  ip_address?: string;
  area_name?: string;
  state?: string;
  last_activity?: string;
  user_count?: number;
  fp_count?: number;
  face_count?: number;
  transaction_count?: number;
  [key: string]: unknown;
}

/** A personnel record as returned by the ZKBioTime employee directory. */
export interface ZkEmployee {
  id: number;
  emp_code: string;
  first_name?: string;
  last_name?: string;
  department?: { id: number; dept_name?: string } | null;
  area?: Array<{ id: number; area_name?: string }>;
  /** Biometric enrollment state on the terminal: a value like "Ver 12:1" means enrolled; "-" means none. */
  fingerprint?: string | null;
  face?: string | null;
  /** Visible-light face template + photo (ZK face devices register here). */
  vl_face?: string | null;
  vl_face_photo?: number | null;
  palm?: string | null;
  [key: string]: unknown;
}

export interface ZkDirectoryResponse<T> {
  mode: string;
  count: number;
  data: T[];
  /** Base URL of the ZKBioTime web (for deep-linking to enrollment). Only on the devices response. */
  webUrl?: string | null;
}

/** ZKBioTime connection config (editable from the admin screen). */
export interface ZkConfig {
  baseUrl?: string | null;
  username?: string | null;
  passwordSet?: boolean;
  authPath?: string;
  tokenScheme?: string;
  serverTimeUtcOffsetHours?: string;
  /** "database" (set from screen) or "appsettings" (from config file). */
  source?: string;
}

export interface ZkTestResult {
  ok: boolean;
  deviceCount: number;
  message: string;
}

/** Result of identifying the last person who presented a biometric at the device. */
export interface ZkLastPunch {
  found: boolean;
  empCode?: string;
  deviceName?: string;
  verifyType?: number;
  verifyTypeDisplay?: string;
  uploadTime?: string;
  punchTime?: string;
  terminalSn?: string;
  applicant?: BiometricApplicantLookup | null;
}

/** A single resolved punch in the realtime device feed. */
export interface ZkRecentPunch {
  empCode: string;
  deviceName?: string | null;
  verifyType?: number;
  verifyTypeDisplay?: string | null;
  uploadTime?: string | null;
  punchTime?: string | null;
  terminalSn?: string | null;
  terminalAlias?: string | null;
  areaName?: string | null;
  deviceEmpId?: number | null;
  applicantId?: string | null;
  applicantName?: string | null;
}

export interface ZkRecentPunchesResponse {
  count: number;
  data: ZkRecentPunch[];
}

export const biometricService = {
  /**
   * Live list of ZKBioTime terminals (devices). Active once a server connection
   * is saved from the admin screen (or set in appsettings); otherwise the API
   * returns 409 ZK_MODE_INACTIVE.
   */
  async getZkDevices(): Promise<ZkDirectoryResponse<ZkDevice>> {
    return apiClient.get<ZkDirectoryResponse<ZkDevice>>('/api/biometric/zk/devices');
  },

  /** Live, paged list of ZKBioTime personnel (employees). */
  async getZkEmployees(page = 1, pageSize = 100): Promise<ZkDirectoryResponse<ZkEmployee>> {
    return apiClient.get<ZkDirectoryResponse<ZkEmployee>>('/api/biometric/zk/employees', {
      query: { page, pageSize },
    });
  },

  /**
   * Identify whoever last presented a biometric at the terminal (1:N). The
   * device does the match and stamps the emp_code; this resolves it to an
   * applicant (emp_code = national id) when one exists.
   */
  async getZkLastPunch(windowSeconds = 120): Promise<ZkLastPunch> {
    return apiClient.get<ZkLastPunch>('/api/biometric/zk/last-punch', {
      query: { windowSeconds },
    });
  },

  /** Realtime feed of recent device punches, each resolved to an applicant. */
  async getZkRecentPunches(windowSeconds = 300, limit = 20): Promise<ZkRecentPunchesResponse> {
    return apiClient.get<ZkRecentPunchesResponse>('/api/biometric/zk/recent-punches', {
      query: { windowSeconds, limit },
    });
  },

  /** Current ZKBioTime connection config (password never returned). */
  async getZkConfig(): Promise<ZkConfig> {
    return apiClient.get<ZkConfig>('/api/biometric/zk/config');
  },

  /** Save the ZKBioTime connection config. Password is updated only if non-empty. */
  async saveZkConfig(input: {
    BaseUrl?: string;
    Username?: string;
    Password?: string;
    AuthPath?: string;
    TokenScheme?: string;
    ServerTimeUtcOffsetHours?: string;
  }): Promise<{ ok: boolean }> {
    return apiClient.put<{ ok: boolean }>('/api/biometric/zk/config', input);
  },

  /** Test the live connection to the configured ZKBioTime server. */
  async testZkConnection(): Promise<ZkTestResult> {
    return apiClient.post<ZkTestResult>('/api/biometric/zk/test-connection', {});
  },

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
      fingerprintCount: input.fingerprintCaptured ? Math.max(1, input.fingerprintCount ?? 1) : 0,
      fingerprintTemplates: Array.from({ length: input.fingerprintCaptured ? Math.max(1, input.fingerprintCount ?? 1) : 0 }, (_, index) => ({
        finger: index + 1,
        templateRef: `tmpl/${input.cycleId}/${input.applicantId}/finger-${index + 1}`,
        quality: 94 - Math.min(index, 4),
      })),
      faceTemplateRef: input.faceCaptured ? `tmpl/${input.cycleId}/${input.applicantId}/face` : null,
      livenessConfirmed: input.faceCaptured,
      templateRef: `tmpl/${input.cycleId}/${input.applicantId}`,
      status,
      retake: Boolean(input.retake),
      source: input.retake ? 'retake' : 'live_capture',
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

  async linkPreviousEnrollment(input: {
    applicantId: string;
    nationalId: string;
    barcode: string;
    cycleId: string;
    userId: string;
  }): Promise<BiometricEnrollmentRecord> {
    if (isBackendEnabled()) {
      return apiClient.post<BiometricEnrollmentRecord>('/api/biometric/enroll/link-previous', input);
    }
    await simulateLatency(350, 700);
    const previous = ENROLL_STATE.find((e) => e.applicantId === input.applicantId && e.cycleId !== input.cycleId);
    if (!previous) throw new Error('لا توجد بيانات بيومترية سابقة لهذا المتقدم');
    const next: BiometricEnrollmentRecord = {
      ...previous,
      id: `BIO-LINK-${String(enrollId++).padStart(5, '0')}`,
      nationalId: input.nationalId,
      barcode: input.barcode,
      cycleId: input.cycleId,
      enrolledAt: Date.now(),
      enrolledBy: input.userId,
      linkedFromEnrollmentId: previous.id,
      linkedFromCycleId: previous.cycleId,
      source: 'linked_previous',
      retake: false,
    };
    ENROLL_STATE.unshift(next);
    pushAudit({
      user: input.userId,
      timestamp: next.enrolledAt,
      applicantId: input.applicantId,
      applicantName: findApplicant({ applicantId: input.applicantId })?.name ?? 'متقدم غير معروف',
      action: 'link_previous',
      result: 'enrolled',
    });
    return next;
  },

  /**
   * Listen-and-verify (1:N): the backend takes the latest device punch within
   * the window, identifies the applicant by the device-assigned employee id, and
   * runs the verification — no identifier typed by the operator.
   */
  async verifyLive(input: {
    module?: VerificationModule;
    method?: VerificationMethod;
    windowSeconds?: number;
    terminalSn?: string;
  }): Promise<VerifyResult> {
    return apiClient.post<VerifyResult>('/api/biometric/verify-live', input);
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
    const alertCodes: BiometricAlertCode[] = [];
    const voiceAlerts: string[] = [];

    if (lookup.enrollmentStatus === 'not_enrolled') {
      status = 'not_enrolled';
      reason = 'المتقدم غير مسجل بيومترياً';
      alertCodes.push('NOT_REGISTERED');
      voiceAlerts.push('المتقدم غير مسجل على المنظومة');
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
    if (input.today && lookup.currentExamDate && input.today !== lookup.currentExamDate) {
      status = 'manual_review_required';
      reason ??= 'تاريخ اختبار المتقدم لا يوافق اليوم';
      alertCodes.push('EXAM_DATE_MISMATCH');
      voiceAlerts.push('تاريخ اختبار المتقدم لا يوافق اليوم');
    }
    if (input.stationCommittee && input.stationCommittee !== lookup.committee) {
      status = 'manual_review_required';
      reason ??= 'المتقدم غير مسجل في هذه اللجنة';
      alertCodes.push('COMMITTEE_MISMATCH');
      voiceAlerts.push('المتقدم غير مسجل في هذه اللجنة');
    }

    VERIFY_STATE.unshift({
      id: `VER-${String(verifyId++).padStart(5, '0')}`,
      applicantId: applicant.id,
      applicantName: applicant.name,
      method: input.method ?? 'fingerprint',
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
      canContinue: status === 'match' && alertCodes.length === 0,
      alertCodes,
      voiceAlerts,
    };
  },

  async recordGateLog(input: {
    applicantId: string;
    direction: GateDirection;
    verificationResult: VerificationStatus;
    operator: string;
    committee?: string;
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
      registeredAttendance: GATE_STATE.slice(0, 100),
      insideCommittees: buildPresence().byCommittee,
      enrollment: [
        { label: 'مسجل بالكامل', value: enrolled },
        { label: 'تسجيل جزئي', value: partial },
        { label: 'غير مسجل', value: notEnrolled },
      ],
    };
  },

  async presence(): Promise<BiometricPresence> {
    if (isBackendEnabled()) {
      return apiClient.get<BiometricPresence>('/api/biometric/presence');
    }
    await simulateLatency();
    return buildPresence();
  },

  async exportReport(format: ExportFormat): Promise<{ fileName: string }> {
    await simulateLatency(350, 700);
    return { fileName: `biometric-report.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf'}` };
  },

  async monitoring(): Promise<{
    last24h: { ts: number; count: number }[];
    perStation: Record<string, { total: number; match: number; failed: number }>;
    recentFailures: Array<{
      id: string;
      applicantId: string;
      station: string;
      ts: number;
      method: VerificationMethod;
      match: boolean;
      confidence?: number;
    }>;
  }> {
    if (isBackendEnabled()) {
      return apiClient.get<{
        last24h: { ts: number; count: number }[];
        perStation: Record<string, { total: number; match: number; failed: number }>;
        recentFailures: Array<{
          id: string;
          applicantId: string;
          station: string;
          ts: number;
          method: VerificationMethod;
          match: boolean;
          confidence?: number;
        }>;
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
      'medical-commission': { total: 0, match: 0, failed: 0 },
      'medical-clinic': { total: 0, match: 0, failed: 0 },
    };
    for (const v of recent) {
      const station = mapStatusToStation(v.module);
      perStation[station]!.total += 1;
      if (v.result === 'match') perStation[station]!.match += 1;
      else perStation[station]!.failed += 1;
    }
    const recentFailures: Array<{
      id: string;
      applicantId: string;
      station: string;
      ts: number;
      method: VerificationMethod;
      match: boolean;
      confidence?: number;
    }> = recent
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
