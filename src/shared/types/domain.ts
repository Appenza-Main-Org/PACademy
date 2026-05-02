/**
 * Cross-feature domain types — shapes used by mock-data and services.
 */

export type ApplicantStatus =
  | 'pending'
  | 'under-review'
  | 'approved'
  | 'rejected'
  | 'on-hold'
  | 'documents-required';

export type PaymentStatus = 'paid' | 'pending';
export type InvestigationStatus = 'pending' | 'cleared' | 'flagged';
export type ResultOutcome = 'pass' | 'fail' | null;

export interface ApplicantResults {
  medical: ResultOutcome;
  fitness: ResultOutcome;
  interview: ResultOutcome;
  finalExam: ResultOutcome;
}

export interface Applicant {
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

export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'login' | 'export';
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

/* ── Admission cycles — Sprint 1 (§1.2.D) ─────────────────────────────── */

export type CycleStatus = 'draft' | 'open' | 'closed' | 'processing' | 'finalized';

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

/* ── Reports — Sprint 1 (§1.2.F) ──────────────────────────────────────── */

export type ReportTemplateKey =
  | 'applicants-by-status'
  | 'applicants-by-governorate'
  | 'applicants-by-certificate'
  | 'rejections-with-reasons'
  | 'medical-results-summary'
  | 'exam-pass-rates'
  | 'investigation-status'
  | 'cycle-summary'
  | 'audit-export';

export interface ReportRow {
  label: string;
  value: number | string;
  /** Optional secondary metric (e.g. percentage). */
  secondary?: string;
}

export interface ReportDocument {
  key: ReportTemplateKey;
  title: string;
  generatedAt: string;
  cycleId: string | null;
  rows: ReportRow[];
}
