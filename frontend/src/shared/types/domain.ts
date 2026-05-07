/**
 * Cross-feature domain types — shapes used by mock-data and services.
 */

import type { AppKey } from '@/shared/lib/constants';

export type ApplicantStatus =
  | 'pending'
  | 'under-review'
  | 'approved'
  | 'rejected'
  | 'on-hold'
  | 'documents-required'
  /* Workflow-runtime statuses (post-polish — RFP §3 / §6 pipeline). Additive
   * to the legacy admin filter set; existing consumers keep working. */
  | 'under_medical_review'
  | 'passed_physical'
  | 'failed_interview'
  | 'awaiting_board_decision';

export type PaymentStatus = 'paid' | 'pending';
export type InvestigationStatus = 'pending' | 'cleared' | 'flagged';
export type ResultOutcome = 'pass' | 'fail' | null;

export interface ApplicantResults {
  medical: ResultOutcome;
  fitness: ResultOutcome;
  interview: ResultOutcome;
  finalExam: ResultOutcome;
}

/* ── Extended applicant data (admin Add/Edit form — RFP pp.22-36) ───────────
 * Optional sidecars on the base Applicant. The legacy MOCK seed leaves them
 * empty; admin-created applicants populate them. View/Edit pages render
 * sections only when their data exists. */

export type DepartmentKey =
  | 'general_first'
  | 'general_second'
  | 'special'
  | 'lawyers'
  | 'masters'
  | 'doctorate';

export type Religion = 'مسلم' | 'مسيحي';
export type MaritalStatus = 'أعزب' | 'متزوج' | 'مطلق' | 'أرمل';

export interface ApplicantContact {
  homePhone?: string;
  mobilePhone: string;
  email?: string;
  socialFacebook?: string;
  socialInstagram?: string;
  socialX?: string;
  socialOther?: string;
}

export interface ApplicantAddress {
  governorate: string;
  city: string;
  detail: string;
  street?: string;
}

/** Discriminated by department; admin form swaps the rendered fields per §4. */
export type ApplicantEducation =
  | {
      kind: 'general';
      certificateName: string;
      schoolName: string;
      totalScore: number;
      seatType?: string;
      branch: 'علمي علوم' | 'علمي رياضة' | 'أدبي';
      schoolCategory?: string;
      graduationYear: number;
      percentage?: number;
    }
  | {
      kind: 'overseas';
      certificateName: string;
      schoolName: string;
      totalScore: number;
      seatType?: string;
      schoolCategory?: string;
      country: string;
      graduationYear: number;
    }
  | {
      kind: 'higher';
      specialization: string;
      university: string;
      faculty: string;
      totalScore: number;
      grade?: string;
      higherSpecialization?: string;
      graduationYear: number;
      secondary: {
        certificateName: string;
        totalScore: number;
        schoolCategory?: string;
        country?: string;
        percentage?: number;
      };
    };

export interface ApplicantFamilyMember {
  fullName: string;
  nationalId?: string;
  occupation?: string;
  alive: boolean;
  governorate?: string;
  education?: string;
  /** Only used on the relatives array. */
  relationshipId?: string;
}

export interface ApplicantFamily {
  father?: ApplicantFamilyMember;
  mother?: ApplicantFamilyMember;
  paternalGrandfather?: ApplicantFamilyMember;
  paternalGrandmother?: ApplicantFamilyMember;
  maternalGrandfather?: ApplicantFamilyMember;
  maternalGrandmother?: ApplicantFamilyMember;
  siblings?: ApplicantFamilyMember[];
  relatives?: ApplicantFamilyMember[];
}

export interface ApplicantExtended {
  department?: DepartmentKey;
  cycleId?: string;
  religion?: Religion;
  maritalStatus?: MaritalStatus;
  fullName?: { first: string; second: string; third: string; fourth: string };
  contact?: ApplicantContact;
  currentAddress?: ApplicantAddress;
  education?: ApplicantEducation;
  family?: ApplicantFamily;
  /** Free-text reason for any soft "موقوف" status applied by an admin. */
  suspensionReason?: string;
  /** Set when Stage 9 (attendance card print) has fired — locks personal data. */
  attendanceCardPrintedAt?: string;
}

export interface Applicant extends ApplicantExtended {
  id: string;
  nationalId: string;
  name: string;
  gender: 'male' | 'female';
  birthDate: string;
  governorate: string;
  city: string;
  certType: string;
  certSection: string;
  certScore: number;
  certPercent: string;
  certYear: number;
  status: ApplicantStatus;
  stage: number;
  stageLabel: string;
  committee: string;
  registeredAt: string;
  paymentStatus: PaymentStatus;
  paymentAmount: number;
  hasDocuments: boolean;
  photo: string | null;
  results: ApplicantResults;
  familySize: number;
  relativesCount: number;
  investigation: InvestigationStatus;
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'login'
  | 'export'
  /* Workflow + applicant transitions (post-polish — RFP §3/§6 pipeline). */
  | 'workflow.create'
  | 'workflow.update'
  | 'workflow.publish'
  | 'workflow.reorder'
  | 'workflow.delete'
  | 'applicant.transition';
export type AuditColor = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  actionLabel: string;
  actionColor: AuditColor;
  entity: string;
  entityId: string;
  details: string;
  timestamp: number;
  ip: string;
}

export interface SystemUser {
  id: string;
  name: string;
  role: string;
  unit: string;
  active: boolean;
  lastLogin: number;
}

export interface MedicalStation {
  id: string;
  name: string;
  doctor: string;
  queue: number;
  completed: number;
}

export interface Committee {
  id: string;
  name: string;
  head: string;
  members: number;
  applicants: number;
  completed: number;
}

export interface Question {
  id: string;
  category: string;
  difficulty: 'سهل' | 'متوسط' | 'صعب';
  text: string;
  options: string[];
  correctIndex: number;
  usedCount: number;
}

export interface DayPoint {
  date: string;
  label: string;
  registrations: number;
  payments: number;
  tests: number;
}

export interface Kpis {
  totalApplicants: number;
  paidApplicants: number;
  underReview: number;
  approved: number;
  rejected: number;
  pending: number;
  byGender: { male: number; female: number };
  byCertType: Record<string, number>;
}

export interface TimelineEvent {
  ts: number;
  type: 'registration' | 'payment' | 'document' | 'medical' | 'fitness' | 'interview' | 'exam' | 'committee' | 'decision';
  icon: string;
  title: string;
  detail: string;
  color: AuditColor;
}

/* ── Applicant categories — Post-polish (RFP Scope Document §2.1) ─────
 *
 * Source spec: كلية_الشرطة_الاقسام_والشروط — 7 faculty departments with
 * their conditions and required-test sequences. Departments 4–7 are
 * `nominationOnly: true` (ترشيح) and never appear in the public picker.
 */

export type ApplicantCategoryKey =
  | 'officers_general'
  | 'officers_specialized'
  | 'postgraduate'
  | 'institute_officers_training'
  | 'institute_traffic'
  | 'institute_guarding'
  | 'special_units';

export type RequiredQualification =
  | 'thanaweya_amma'
  | 'azhar'
  | 'bachelor'
  | 'bachelor_law'
  | 'bachelor_medicine'
  | 'bachelor_engineering'
  | 'bachelor_media'
  | 'police_academy_grad'
  | 'serving_officer'
  | 'any';

export interface CategoryCondition {
  ageMin: number | null;
  ageMax: number | null;
  minScorePercent: number | null;
  requiredQualification: RequiredQualification;
  gender: 'male' | 'female' | 'any';
  minHeightCm: number | null;
  medicalRequired: boolean;
  maritalStatus: 'single' | 'any';
  conductCheck: boolean;
  egyptianNationalityRequired: boolean;
  employerApprovalRequired: boolean;
  nominationOnly: boolean;
  freeText: string[];
}

export type RequiredTestKind =
  | 'aptitude'
  | 'posture'
  | 'medical'
  | 'physical'
  | 'psychological'
  | 'interview'
  | 'drug'
  | 'security_review'
  | 'tactical_training'
  | 'security_training'
  | 'specialized_courses';

export interface RequiredTest {
  kind: RequiredTestKind;
  order: number;
  passingCriteria: string;
}

export interface ApplicantCategory {
  key: ApplicantCategoryKey;
  labelAr: string;
  labelEn: string;
  description: string;
  /** Computed snapshot from `MOCK.activeCycleId → cycle.openCategories[key]`. */
  isOpen: boolean;
  conditions: CategoryCondition;
  requiredTests: RequiredTest[];
  procedures: string[];
}

export type EligibilityRejectionReason =
  | 'age_out_of_range'
  | 'gender_mismatch'
  | 'data_not_found'
  | 'score_below_min'
  | 'application_closed'
  | 'cycle_not_active'
  | 'nid_already_used'
  | 'qualification_mismatch'
  | 'height_below_min'
  | 'marital_status_mismatch'
  | 'nomination_required';

export interface EligibilityResult {
  categoryKey: ApplicantCategoryKey;
  cycleId: string | null;
  eligible: boolean;
  reasons: EligibilityRejectionReason[];
}

/* ── Reference data — Sprint 1 (Tasks/KARASA_GAPS.md §1.2.B) ────────── */

export type ReferenceTab =
  | 'governorates'
  | 'specializations'
  | 'ranks'
  | 'colleges'
  | 'qualifications'
  | 'nationalities'
  | 'relationships'
  | 'case-types';

export interface RefGovernorate {
  id: string;
  nameAr: string;
  nameEn: string;
  region: 'cairo' | 'delta' | 'canal' | 'upper' | 'frontier';
  active: boolean;
}

export interface RefSpecialization {
  id: string;
  nameAr: string;
  code: string;
  facultyType: 'civil' | 'military' | 'sciences';
  active: boolean;
}

export interface RefRank {
  id: string;
  nameAr: string;
  level: number;
  applicableTo: 'officer' | 'enlisted' | 'civilian';
}

export interface RefCollege {
  id: string;
  nameAr: string;
  governorateId: string;
  type: 'public' | 'private' | 'azhar';
  active: boolean;
}

export interface RefQualification {
  id: string;
  nameAr: string;
  level: 'diploma' | 'bachelor' | 'master' | 'phd';
  facultyRequired: boolean;
}

export interface RefNationality {
  id: string;
  nameAr: string;
  nameEn: string;
  isoCode: string;
}

export interface RefRelationship {
  id: string;
  nameAr: string;
  degree: 1 | 2 | 3 | 4;
  side: 'paternal' | 'maternal' | 'spouse' | 'self';
}

export interface RefCaseType {
  id: string;
  nameAr: string;
  severity: 'low' | 'medium' | 'high';
  blocksApplication: boolean;
}

/** Discriminated union mapping each reference tab to its row shape. */
export type ReferenceRowMap = {
  governorates: RefGovernorate;
  specializations: RefSpecialization;
  ranks: RefRank;
  colleges: RefCollege;
  qualifications: RefQualification;
  nationalities: RefNationality;
  relationships: RefRelationship;
  'case-types': RefCaseType;
};

/* ── Admission cycles — Sprint 1 (§1.2.D), extended post-polish ─────────
 *
 * Post-polish extension: `openCategories`, `conditionOverrides`,
 * `createdAt`/`updatedAt`, and the additional `'active'`/`'archived'`
 * status tokens. Existing fields (`nameAr`, `openDate`, `closeDate`,
 * `cohort`, `year`, `expectedCapacity`, `applicantCount`) are kept as-is
 * for backwards compatibility with CyclesPage/CycleDetailPage and
 * AdmissionRule references. Map old↔new at the service layer:
 *   'open' ≡ 'active', 'finalized' ≡ 'archived', 'processing' is internal.
 */

export type CycleStatus = 'draft' | 'open' | 'active' | 'closed' | 'processing' | 'finalized' | 'archived';

export interface AdmissionCycleCategoryConfig {
  isOpen: boolean;
  capacity: number | null;
  notes: string;
}

export interface AdmissionCycle {
  id: string;
  nameAr: string;
  /** Year + cohort marker, e.g. 2026-male / 2026-female. */
  cohort: 'male' | 'female';
  year: number;
  openDate: string; // ISO
  closeDate: string; // ISO
  expectedCapacity: number;
  applicantCount: number;
  status: CycleStatus;
  /** English label, optional — defaults to a computed transliteration in UI. */
  labelEn?: string;
  /** Per-category open/closed/capacity/notes within this cycle.
   *  Missing key === closed for that category in this cycle. */
  openCategories?: Partial<Record<ApplicantCategoryKey, AdmissionCycleCategoryConfig>>;
  /** Cycle-level overrides on category conditions. Override semantics: a
   *  defined field replaces the category default; missing fields fall through. */
  conditionOverrides?: Partial<Record<ApplicantCategoryKey, Partial<CategoryCondition>>>;
  createdAt?: string;
  updatedAt?: string;
}

/* ── Admission rules — Sprint 1 (§1.2.C) ──────────────────────────────── */

export interface AdmissionRule {
  id: string;
  cycleId: string;
  version: number;
  /** ISO timestamp of effective date. */
  effectiveAt: string;
  changedBy: { userId: string; name: string };

  age: { minYears: number; maxYears: number; maxMonths?: number };
  height: {
    male: { min: number; max: number };
    female: { min: number; max: number };
  };
  bmi: { min: number; max: number };
  eyesight: {
    minRightEye: string; // e.g. "6/9"
    minLeftEye: string;
    correctionAllowed: boolean;
  };
  maritalStatus: ReadonlyArray<'single' | 'married' | 'divorced' | 'widowed'>;
  noCriminalRecord: boolean;
  acceptedCertificates: ReadonlyArray<string>; // refers to RefSpecialization or cert types
  minPercentByCertType: Record<string, number>;
  applicationFee: Record<string, number>;
  maxApplicationsPerYear: number;
}

/* ── User activity — Sprint 1 (§1.2.E) ────────────────────────────────── */

export interface UserActivityEntry {
  ts: number;
  userId: string;
  action: string;
  detail: string;
  ip?: string;
}

/* ── Audit diff — Sprint 1 (§1.2.G) ───────────────────────────────────── */

export interface AuditDiff {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/* ── Reports command center — super_admin /admin/reports ────────────────
 *
 * Aggregate shapes returned by the reports service. Every metric is
 * derived from the existing MOCK collections (applicants, audit,
 * committees, medicalStations, boardSessions, examConfigs, …) plus
 * a deterministic string-hash for any synthesis. No parallel data
 * store; LCG seed integrity is preserved.
 */

export type TestKindForReport = 'medical' | 'physical' | 'psychological' | 'interview' | 'drug';
export type IntegrationHealth = 'healthy' | 'degraded' | 'down';

export interface CycleSnapshot {
  cycleId: string;
  cycleLabelAr: string;
  openDateIso: string;
  closeDateIso: string;
  hijriCloseDate: string;
  daysRemaining: number;
  capacity: number | null;
  totalApplicants: number;
  finalApproved: number;
  acceptanceRate: number;
  prevCycleAcceptanceRate: number;
  registrationTempo: {
    thisCycle: { label: string; value: number }[];
    prevCycle: { label: string; value: number }[];
    deltaPercent: number;
  };
  categoriesOpen: { key: ApplicantCategoryKey; labelAr: string; isOpen: boolean; capacity: number | null }[];
  integrationsHealthy: number;
  integrationsTotal: number;
  generatedAt: string;
}

export interface StageFunnelPoint {
  stageIndex: number;
  stageLabel: string;
  count: number;
  percentOfTotal: number;
  dropOffFromPrevPercent: number;
  avgDaysAtStage: number;
  isBottleneck: boolean;
}

export interface DepartmentSummary {
  key: ApplicantCategoryKey;
  labelAr: string;
  total: number;
  percentOfTotal: number;
  eligibilityPassed: number;
  eligibilityFailed: number;
  eligibilityPending: number;
  eligibilityPassRate: number;
}

export interface RejectionReasonStat {
  reason: EligibilityRejectionReason;
  labelAr: string;
  count: number;
  percent: number;
}

export interface DepartmentReport {
  byDepartment: DepartmentSummary[];
  topRejectionReasons: RejectionReasonStat[];
}

export interface TestKindResult {
  kind: TestKindForReport;
  labelAr: string;
  passed: number;
  failed: number;
  pending: number;
  passRate: number;
  prevCyclePassRate: number;
  deltaPercent: number;
}

export interface TestResultsReport {
  byKind: TestKindResult[];
  governorateHeatmap: {
    governorates: string[];
    kinds: TestKindForReport[];
    /** rows × cols matrix of pass-rate percentages (0..100). */
    passRates: number[][];
  };
}

export interface CommitteeOpStatus {
  id: string;
  name: string;
  todayQueue: number;
  todayProcessed: number;
  signedOffToday: boolean;
}

export interface MedicalStationOpStatus {
  id: string;
  name: string;
  queue: number;
  avgWaitMinutes: number;
}

export interface BoardSessionOpStatus {
  id: string;
  label: string;
  scheduledTime: string;
  state: 'scheduled' | 'live' | 'decided';
  memberCount: number;
}

export interface OngoingExamStatus {
  id: string;
  name: string;
  startedTime: string;
  takingCount: number;
  avgCompletionPercent: number;
  abandonedCount: number;
}

export interface OperationalStatus {
  committees: CommitteeOpStatus[];
  medicalStations: MedicalStationOpStatus[];
  boardSessions: BoardSessionOpStatus[];
  ongoingExams: OngoingExamStatus[];
}

export interface AuditHourBucket {
  /** Hour-of-day label, e.g. "08". */
  label: string;
  total: number;
  highSensitivity: number;
}

export interface AnomalySignal {
  id: string;
  timestamp: number;
  actor: string;
  actionLabel: string;
  applicantId?: string;
  detail: string;
  reason: string;
}

export interface GovernanceReport {
  hourly: AuditHourBucket[];
  anomalies: AnomalySignal[];
  totalLast24h: number;
  highSensitivityLast24h: number;
}

export interface IntegrationStatus {
  key: string;
  nameAr: string;
  status: IntegrationHealth;
  lastCallRelative: string;
  callsToday: number;
}

/* ── Applicant portal — Sprint 2 (KARASA_GAPS §2) ────────────────────── */

export type ApplicantStageKey =
  | 'auth-1'
  | 'auth-2'
  | 'personal'
  | 'education'
  | 'marital'
  | 'payment'
  | 'family'
  | 'exam-schedule'
  | 'print-card'
  | 'follow-up'
  | 'acquaintance-doc';

export interface FamilyMember {
  id: string;
  fullName: string;
  nationalId?: string;
  occupation?: string;
  alive: boolean;
  causeOfDeath?: string;
  governorate?: string;
  education?: string;
}

export interface RelativeMember extends FamilyMember {
  relationshipId: string;
}

export interface SpouseInfo {
  fullName: string;
  nationalId: string;
  marriageDate: string;
  occupation?: string;
}

export type PipelineState = 'pending' | 'in-progress' | 'passed' | 'failed' | 'awaiting-approval';

export interface ApplicantDraft {
  applicantId: string;
  cycleId: string;
  furthestStage: number;
  suspended: boolean;
  lastSavedAt: number;
  auth?: {
    nationalId: string;
    phoneNumber: string;
    smsVerifiedAt?: number;
  };
  personal?: Record<string, unknown>;
  education?: Record<string, unknown>;
  marital?: Record<string, unknown>;
  payment?: {
    method: 'fawry' | 'card';
    fawryCode?: string;
    refNumber?: string;
    amount: number;
    paidAt?: number;
  };
  family?: Record<string, unknown>;
  examSlot?: { slotId: string; date: string; time: string; location: string };
  followUp?: Record<string, PipelineState>;
  acquaintance?: Record<string, unknown>;
}

export interface ExamSlot {
  id: string;
  date: string;
  time: string;
  location: string;
  capacity: number;
  reserved: number;
}

export interface PaymentTransaction {
  refNumber: string;
  applicantId: string;
  method: 'fawry' | 'card';
  amount: number;
  status: 'pending' | 'success' | 'failed';
  initiatedAt: number;
  paidAt?: number;
}

/* ── Test schedule — Post-polish (Bucket C) ───────────────────────── */

export type TestStatus =
  | 'scheduled'
  | 'attended'
  | 'missed'
  | 'passed'
  | 'failed'
  | 'pending_result';

export interface TestSchedule {
  id: string;
  applicantId: string;
  kind: RequiredTestKind;
  scheduledAt: string; // ISO
  location: string;
  status: TestStatus;
  resultAt?: string;
  score?: number;
  notes?: string;
  instructions: string[];
}

/* ── Two-phase results pattern (committees + medical + exams) ────────── */

export type ResultPhase = 'preliminary' | 'final' | 'rejected';

/* ── Committees — Sprint 3 (RFP Scope Document §3) ──────────────────────────────── */

export type CommitteeType = 'capacities' | 'traits' | 'sports' | 'interview';

export interface CommitteeResult {
  id: string;
  committeeId: string;
  applicantId: string;
  applicantName: string;
  enteredBy: string;
  enteredAt: number;
  approvedBy?: string;
  approvedAt?: number;
  phase: ResultPhase;
  rejectionReason?: string;
  scores: Record<string, number>;
  passFail: 'pass' | 'fail';
  notes?: string;
}

/* ── Medical — Sprint 4 (RFP Scope Document §6) ─────────────────────────────────── */

export type MedicalStationKey =
  | 'eye'
  | 'ent'
  | 'internal'
  | 'orthopedic'
  | 'neuro'
  | 'psychology'
  | 'surgery'
  | 'bmi';
export type MedicalVerdict = 'pass' | 'conditional' | 'fail';

export interface MedicalExamResult {
  id: string;
  applicantId: string;
  applicantName: string;
  station: MedicalStationKey;
  doctor: string;
  enteredAt: number;
  phase: ResultPhase;
  verdict: MedicalVerdict;
  fields: Record<string, string | number | boolean>;
  notes?: string;
}

/* ── Investigations — Sprint 5 (RFP Scope Document §5) ─────────────────────────── */

export type CaseStatus = 'open' | 'in-review' | 'pass' | 'fail' | 'defer-conditional';
export type CasePriority = 'low' | 'medium' | 'high' | 'critical';

export interface InvestigationCase {
  id: string;
  applicantId: string;
  applicantName: string;
  caseType: 'committee-A' | 'committee-C' | 'data-review';
  assignedTo: string;
  priority: CasePriority;
  dueDate: string;
  openedAt: number;
  status: CaseStatus;
  conclusion?: string;
}

export interface OutgoingLetter {
  id: string;
  caseId?: string;
  to: string;
  subject: string;
  template: string;
  status: 'drafted' | 'sent' | 'acknowledged' | 'responded' | 'closed';
  sentAt?: number;
}

/* ── Board — Sprint 6 (RFP Scope Document §4) ───────────────────────────────────── */

export interface BoardMember {
  id: string;
  name: string;
  rank: string;
  role: 'chair' | 'secretary' | 'member';
}

export interface BoardSession {
  id: string;
  date: string;
  time: string;
  location: string;
  agenda: string[];
  attendees: string[];
  applicantIds: string[];
  status: 'scheduled' | 'live' | 'closed';
}

export interface BoardDecision {
  id: string;
  number: string;
  date: string;
  hijriDate: string;
  sessionId: string;
  applicantId: string;
  outcome: 'accepted' | 'rejected' | 'deferred';
  body: string;
  signatures: string[];
}

/* ── Question Bank & e-Exams — Sprint 7 (RFP Scope Document §9) ────────────────── */

export type QuestionType = 'mcq' | 'true-false' | 'ordering' | 'fill-in';
export type QuestionStatus = 'draft' | 'review' | 'approved' | 'live';

export interface BankQuestion {
  id: string;
  category: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  type: QuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  timeLimitSeconds: number;
  notes?: string;
  status: QuestionStatus;
  version: number;
  imageUrl?: string;
}

export interface ExamConfig {
  id: string;
  nameAr: string;
  cycleId: string;
  scheduledFor: string;
  rules: { category: string; difficultyMin: number; difficultyMax: number; count: number; minutes: number }[];
  questionIds: string[];
  status: 'draft' | 'published' | 'completed';
}

export interface ExamAttempt {
  id: string;
  examId: string;
  applicantId: string;
  startedAt: number;
  submittedAt?: number;
  answers: Record<string, number>;
  flagged: string[];
  score?: number;
  passFail?: 'pass' | 'fail';
}

/** Payload for the bulk import wizard — mirrors a manually-created question.
 *  Resolves to a `BankQuestion` after the service stamps id/status/version.
 *  See `examsService.createQuestionBatch`. */
export interface QuestionDraft {
  category: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  type: QuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  timeLimitSeconds: number;
  notes?: string;
}

export interface BatchCreateResult {
  created: number;
  skipped: number;
  ids: string[];
}

/** Live proctor surface — one session row per applicant in a running exam. */
export type SessionStatus = 'not-started' | 'started' | 'in-progress' | 'dropped' | 'finished';

export interface ExamSession {
  id: string;
  examId: string;
  applicantId: string;
  applicantName: string;
  status: SessionStatus;
  startedAt: number | null;
  lastHeartbeatAt: number | null;
  questionsAnswered: number;
  totalQuestions: number;
  durationSeconds: number;
  ip: string;
  mac: string;
}

export interface LiveSessionsResponse {
  sessions: ExamSession[];
  totalsByStatus: Record<SessionStatus, number>;
  /** ISO timestamp — used by the polling ticker to render "آخر تحديث منذ N". */
  lastUpdated: string;
  /** 24-cell strip of "answers in the last 60s" per minute over the last hour. */
  answersPerMinute: number[];
}

/* ── Biometric — Sprint 8 (RFP Scope Document §8) ──────────────────────────────── */

export interface BiometricEnrollment {
  id: string;
  applicantId: string;
  enrolledAt: number;
  faceCaptured: boolean;
  fingerprintCaptured: boolean;
  livenessConfirmed: boolean;
  templateRef: string;
}

export interface BiometricVerification {
  id: string;
  applicantId: string;
  station: 'gate' | 'exam-room' | 'committee';
  ts: number;
  method: 'face' | 'fingerprint' | 'barcode';
  match: boolean;
  confidence?: number;
  override?: { by: string; reason: string };
}

/* ── Barcode — Sprint 8 (RFP Scope Document §7) ─────────────────────────────────── */

export interface BarcodeRecord {
  applicantId: string;
  code: string;
  cycleId: string;
  governorateCode: string;
  issuedAt: number;
  void: boolean;
  voidReason?: string;
}

export interface BarcodeScan {
  id: string;
  ts: number;
  scannedBy: string;
  applicantId: string;
  station: string;
  action: 'attendance' | 'gate-in' | 'gate-out' | 'forward';
}

/* ── Cross-cutting — Sprint 9 (RFP Scope Document §10) ─────────────────────────── */

export interface NotificationItem {
  id: string;
  ts: number;
  recipientRole: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  href?: string;
}

/* ── Department Workflow Builder — Post-polish (RFP §3 / §6) ───────────────
 *
 * A workflow is a per-department ordered pipeline of stages. Each stage
 * carries one or more tests with pass criteria and declares which next
 * statuses are reachable. Applicants attach to the workflow of their
 * department on creation. Configurator route: /admin/workflows.
 */

export const DEPARTMENT_LABELS: Record<DepartmentKey, string> = {
  general_first: 'قسم عام · دور أول',
  general_second: 'قسم عام · دور ثاني',
  special: 'قسم خاص',
  lawyers: 'الحقوقيين',
  masters: 'ماجستير',
  doctorate: 'دكتوراه',
};

export type TestKind =
  | 'medical'
  | 'physical'
  | 'written'
  | 'interview'
  | 'biometric'
  | 'investigation';

export const TEST_KIND_LABELS: Record<TestKind, string> = {
  medical: 'طبي',
  physical: 'بدني',
  written: 'تحريري',
  interview: 'مقابلة شخصية',
  biometric: 'تحقق حيوي',
  investigation: 'تحريات',
};

export type PassCriterion =
  | { type: 'minScore'; min: number; max: number }
  | { type: 'boolean'; mustBe: 'pass' | 'fail' }
  | { type: 'composite'; rule: 'all' | 'any'; min?: number };

export interface WorkflowTest {
  id: string;
  name: string;
  kind: TestKind;
  required: boolean;
  passCriterion: PassCriterion;
  ownerApp: AppKey;
  notes?: string;
}

export interface WorkflowStage {
  id: string;
  /** 1-based; drag-drop rewrites this. */
  order: number;
  name: string;
  /** Status the applicant gets when entering this stage. */
  statusOnEnter: ApplicantStatus;
  /** Gate of legal next statuses; transition dialogs constrain to this set. */
  allowedNextStatuses: ApplicantStatus[];
  tests: WorkflowTest[];
}

export interface DepartmentWorkflow {
  id: string;
  department: DepartmentKey;
  name: string;
  cycleId: string;
  stages: WorkflowStage[];
  isActive: boolean;
  /** Bumps on every save. Lets us answer "apply to existing applicants?". */
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface WorkflowTestResult {
  stageId: string;
  testId: string;
  outcome: 'pass' | 'fail' | 'pending';
  score?: number;
  recordedAt: string;
  recordedBy: string;
}

export interface ApplicantWorkflowProgress {
  applicantId: string;
  workflowId: string;
  workflowVersion: number;
  /** null = workflow completed (passed) or terminated (rejected). */
  currentStageId: string | null;
  completedStageIds: string[];
  testResults: WorkflowTestResult[];
}

/** Audit trail row for stage transitions on a given applicant. */
export interface WorkflowTransitionEvent {
  id: string;
  applicantId: string;
  ts: number;
  fromStatus: ApplicantStatus | null;
  toStatus: ApplicantStatus;
  fromStageId: string | null;
  toStageId: string | null;
  actorId: string;
  actorName: string;
  reason?: string;
}
