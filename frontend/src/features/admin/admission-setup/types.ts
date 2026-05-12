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

import type { Applicant, SoftDeleteFields } from '@/shared/types/domain';
import type { GradingMode } from '@/features/lookups';

/**
 * Binary gender union, derived from the existing canonical inline shape on
 * `Applicant.gender` (`shared/types/domain.ts`). No new declaration — this
 * is a type alias of an already-shipped union, keeping the codebase's
 * gender contract single-sourced. The lookup-module gender unions
 * (`ApplicantCategoryGenderScope`, `RelationshipGender`, `AnnouncementGender`)
 * include `'any'`; that is wrong for per-year capacity rows where each row
 * is unambiguously male or female.
 */
export type GenderType = Applicant['gender'];

/** Discriminated union of the 14 admission-setup step keys, in canonical order. */
export type AdmissionSetupStepKey =
  | 'application_settings'
  | 'application_status'
  | 'age_rules'
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

/* ───────────────────────────────────────────────────────────────────────
 * Step 1 — Application Settings (global master data, not cycle-scoped).
 *
 * Three-tier hierarchy:
 *   ApplicantCategoryConfig    (per category — points at lookup
 *                               `applicant-categories[CAT-NN]`)
 *     └─ ApplicantCategorySpecialization
 *                              (per attached specialization — points at
 *                               lookup `specializations[SPC-NN]`)
 *         └─ ApplicantSpecializationYear
 *                              (per graduation year × gender; the leaf row
 *                               that carries capacity + window dates)
 *
 * Strict category↔specialization mapping was specified by the prompt
 * but the lookup module has no such mapping table today (the only
 * cross-lookup wiring left is the `facultyCode` FK on each
 * specialization row, which is faculty↔specialization not
 * category↔specialization). For V1 the service therefore does not
 * enforce a mapping filter — `SPECIALIZATION_NOT_MAPPED` is reserved
 * for the day the backend ships the junction.
 * ─────────────────────────────────────────────────────────────────────── */

export interface ApplicantCategoryConfig {
  id: string;
  /** FK → lookup `applicant-categories[CAT-NN].code`. */
  categoryId: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicantCategorySpecialization {
  id: string;
  configId: string;
  /** FK → lookup `specializations[SPC-NN].code`. */
  specializationId: string;
  isActive: boolean;
}

/**
 * The leaf row that carries the eligibility window + grade gate for one
 * (category-specialization × graduation year × gender set) cell.
 *
 * Discriminated union on `gradeKind`:
 *  - `'GRADES'`  — numeric percentage floor (`minPercentage` 0–100).
 *  - `'TAGDIR'`  — categorical تقدير picked from the `academic-grades`
 *                  lookup (`academicGradeId` is the FK code).
 *
 * `gradeKind` is **not** user-editable. It's derived at row-creation
 * time by walking
 *   categorySpecializationId → configId → categoryId
 *     → lookup `applicant-categories[code].metadata.submissionTypeCode`
 *     → lookup `submission-types[code].metadata.gradingMode`
 * and is immutable for the life of the row. The conflict banner at the
 * top of the application-settings page surfaces any drift when an admin
 * re-points a category at a different submission-type after rows
 * already exist (see `GRADE_MODE_MISMATCH`).
 *
 * `genderTypes` and `maritalStatusCodes` stay multi-select (V1
 * inventory blocker A — option 2). `maxAge` stays nullable. Each `null`
 * bound means "no bound", not "must be null at write time".
 */
export interface ApplicantSpecializationYearBase {
  id: string;
  categorySpecializationId: string;
  /** Multi-select set of acceptable graduation years (last 4 + current).
   *  At least one year must be picked. */
  graduationYears: number[];
  /** Multi-select. At least one gender must be picked. When the parent
   *  category's `genderScope` is not `'any'`, the UI locks this set to
   *  the single allowed gender. */
  genderTypes: GenderType[];
  /** Multi-select. FK → `marital-statuses[code]`. Empty array = any. */
  maritalStatusCodes: string[];
  /** Optional lower age bound — null = no minimum. Must be a positive
   *  integer and `<= maxAge` when both are set. */
  ageMin: number | null;
  /** Optional upper age bound — null = no maximum. */
  maxAge: number | null;
  /** Multi-select. FK → `applicant-divisions[code]` (الشعبة). Empty = any. */
  divisionCodes: string[];
  /** Multi-select. FK → `school-categories[code]` (فئة المدرسة). Surfaced
   *  by the application-settings UI only for the `officers_general`
   *  category per RFP §2.1; an empty array means "any school category". */
  schoolCategoryCodes: string[];
  /** ISO date — start of the application window. */
  applicationStartDate: string;
  /** ISO date — end of the application window. */
  applicationEndDate: string;
  /** ISO date — anchor used by eligibility to compute applicant age.
   *  Must be <= `applicationStartDate`. */
  ageReferenceDate: string;
  isActive: boolean;
}

export interface ApplicantSpecializationYearGrades
  extends ApplicantSpecializationYearBase {
  gradeKind: 'GRADES';
  /** Inclusive percentage floor (0..100). */
  minPercentage: number;
}

export interface ApplicantSpecializationYearTagdir
  extends ApplicantSpecializationYearBase {
  gradeKind: 'TAGDIR';
  /** FK → lookup `academic-grades[code]`. */
  academicGradeId: string;
}

export type ApplicantSpecializationYear =
  | ApplicantSpecializationYearGrades
  | ApplicantSpecializationYearTagdir;

/** Re-export so call sites that need to refer to the discriminator by
 *  type stay decoupled from `@/features/lookups`. */
export type YearGradeKind = GradingMode;

/**
 * Conflict codes thrown by `applicationSettingsService` and surfaced as
 * toasts via `applicationSettings.queries.ts`. Mirrored in
 * `docs/DB_CONSTRAINTS.md §11`.
 */
export type AppSettingsConflict =
  | 'DUPLICATE_YEAR'
  | 'GRAD_YEAR_REQUIRED'
  | 'INVALID_DATE_RANGE'
  | 'OVERLAPPING_PERIOD'
  | 'AGE_NOT_POSITIVE'
  | 'AGE_RANGE_INVALID'
  | 'AGE_REFERENCE_AFTER_START'
  | 'PERCENTAGE_OUT_OF_RANGE'
  | 'GRADE_MODE_MISMATCH'
  | 'GENDER_REQUIRED'
  | 'SPECIALIZATION_NOT_MAPPED'
  | 'CATEGORY_HAS_ACTIVE_YEARS';

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
