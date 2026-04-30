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
