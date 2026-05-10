/**
 * Admission-Setup feature — local type contract.
 *
 * Hosts the 14-step discriminated union plus the four genuinely net-new
 * entities (steps 8, 10, 12, 14). Composed steps (1–7, 11, 13) reuse the
 * shipped types from `@/shared/types/domain` and admin-gaps services.
 *
 * Cycle metadata (name / year / dates) lives in the Cycles section, not
 * inside this wizard — admins enter the wizard with an already-configured
 * cycle selected.
 *
 * Scoped here rather than in domain.ts because nothing outside the
 * admission-setup feature owns or mutates these shapes today; promote on
 * the day they cross-cut other features.
 */

import type { SoftDeleteFields } from '@/shared/types/domain';

/** Discriminated union of the 14 admission-setup step keys, in canonical order. */
export type AdmissionSetupStepKey =
  | 'application_settings'
  | 'application_status'
  | 'age_rules'
  | 'marital_status_rules'
  | 'fees'
  | 'exams'
  | 'committees'
  | 'committee_merge_split'
  | 'score_thresholds'
  | 'exam_dates'
  | 'date_committee_binding'
  | 'total_score'
  | 'notifications'
  | 'electronic_declaration';

/** Per-step status pill state shown on the index landing. */
export type AdmissionSetupStepStatus = 'complete' | 'in_progress' | 'not_started';

/* ───────────────────────────────────────────────────────────────────────
 * Net-new entities — backed by `admissionSetupService` (mock for now).
 * Shapes mirror the proposed SQL Server tables in INTEGRATION_HANDOFF §8.
 * ─────────────────────────────────────────────────────────────────────── */

/** Step 9 — committee merge/split rule. */
export interface CommitteeMergeSplitRule extends SoftDeleteFields {
  id: string;
  cycleId: string;
  type: 'merge' | 'split';
  /** Source committee ids — merge requires ≥2; split requires exactly 1. */
  sourceCommitteeIds: string[];
  /** Target committee ids — merge requires exactly 1; split requires ≥2. */
  targetCommitteeIds: string[];
  reason?: string;
  /** ISO date — when the rule takes effect. */
  effectiveAt: string;
  createdAt: string;
  createdBy: string;
}

/** Step 10 — committee score threshold (acceptance min/max). */
export interface CommitteeScoreThreshold {
  cycleId: string;
  committeeId: string;
  /** Inclusive minimum accepted total score. */
  min: number;
  /** Inclusive maximum accepted total score. */
  max: number;
  updatedAt: string;
  updatedBy: string;
}

/** Step 11 — admission exam date config for the cycle. */
export interface ExamDateConfig {
  id: string;
  cycleId: string;
  /** ISO date — earliest day applicants can be assigned an exam slot. */
  firstAvailableDate: string;
  /** ISO date strings — every date open for booking. */
  bookableDays: string[];
  /** ISO date strings — subset of `bookableDays` blocked off. */
  blackoutDates: string[];
  updatedAt: string;
  updatedBy: string;
}

/** Step 13 — applicant stream the total-score config applies to. */
export type ApplicantStream = 'general' | 'special' | 'law' | 'sports_female';

export interface TotalScoreComponent {
  /** Lookup key into the cycle's exam plan (matches `Exam.id`). */
  examKey: string;
  /** Weight 0..100 — components must sum to 100 per stream. */
  weight: number;
  /** Optional component-level minimum passing score. */
  minimumPassingScore?: number;
}

/** Step 13 — total-score weighting per applicant stream. */
export interface TotalScoreConfig {
  id: string;
  cycleId: string;
  applicantStream: ApplicantStream;
  components: TotalScoreComponent[];
  /** Denominator for the final total (e.g. 100 or 1000). */
  totalScoreOutOf: number;
  updatedAt: string;
  updatedBy: string;
}

/** Step 15 — electronic declaration shown to the applicant on Stage 9. */
export interface ElectronicDeclaration extends SoftDeleteFields {
  id: string;
  cycleId: string;
  bodyAr: string;
  /** Auto-incremented per save. */
  version: number;
  /** ISO date — declaration becomes binding from this date. */
  effectiveFrom: string;
  /** ISO date — set when the admin publishes (visible to applicants). */
  publishedAt?: string;
  createdAt: string;
  createdBy: string;
}
