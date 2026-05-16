/**
 * Admission-Setup feature — local type contract.
 *
 * Hosts the step-key union plus the net-new entities the wizard owns
 * (exam-date config + electronic declaration). Composed steps reuse the
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

import type { Applicant } from '@/shared/types/domain';
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

/** Discriminated union of the admission-setup step keys, in canonical order. */
export type AdmissionSetupStepKey =
  | 'application_settings'
  | 'fees'
  | 'exams'
  | 'committees'
  | 'notifications'
  | 'electronic_declaration';

/** Per-step status pill state shown on the index landing. */
export type AdmissionSetupStepStatus = 'complete' | 'in_progress' | 'not_started';

/* ───────────────────────────────────────────────────────────────────────
 * Net-new entities — backed by `admissionSetupService` (mock for now).
 * Shapes mirror the proposed SQL Server tables in INTEGRATION_HANDOFF §8.
 * ─────────────────────────────────────────────────────────────────────── */

/** Admission exam date config for the cycle. */
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
   *  category's `genderScope` is a single-entry array, the UI locks this
   *  set to that gender (see `ParentCategorySnapshot.lockedGender`). */
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

/* ───────────────────────────────────────────────────────────────────────
 * Exam Schedule — per-category calendar of WORKING/OFF days.
 *
 * Each row is scoped to a single (cycleId × applicantCategoryId × date).
 * The schedule is a pure calendar — no capacity, no slot count, no
 * assignment. Capacity belongs to a separate downstream layer (per-day
 * per-test slot or per-committee binding); see migration report Open
 * Questions for where it lands.
 *
 * Wizard step key is `exam_dates` (legacy name retained for routing /
 * step-status switch continuity); the new semantic name in code and
 * docs is "Exam Schedule".
 * ─────────────────────────────────────────────────────────────────────── */

export const DAY_KIND = ['WORKING', 'OFF'] as const;
export type DayKind = (typeof DAY_KIND)[number];

export interface ExamScheduleDay {
  id: string;
  cycleId: string;
  /** FK → `applicant-categories[CAT-NN].code`. Scopes the day to one
   *  category — same date CAN exist across different categories. */
  applicantCategoryId: string;
  /** ISO yyyy-mm-dd (date only — no time component). */
  date: string;
  kind: DayKind;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * JS `Date.prototype.getDay()` indices for the Egyptian weekend
 * (Friday + Saturday). Hardcoded for V1 — configurable holidays land
 * later via a `HOLIDAYS` lookup (see report Open Questions).
 *
 *   Sun=0 · Mon=1 · Tue=2 · Wed=3 · Thu=4 · Fri=5 · Sat=6
 */
export const WEEKEND_DAY_INDICES: readonly number[] = [5, 6];

/**
 * Conflict codes thrown by `examScheduleService`. Surfaced as Arabic
 * toasts via the query layer. Mirrored in `docs/DB_CONSTRAINTS.md
 * §12`.
 */
export type ExamScheduleConflict =
  | 'DUPLICATE_DATE'
  | 'DATE_OUT_OF_CYCLE_WINDOW'
  | 'INVALID_DATE_RANGE'
  | 'CATEGORY_NOT_ACTIVE';

/* ───────────────────────────────────────────────────────────────────────
 * Committee × Day Bindings — per-(cycle × category × committee × day) row
 * carrying capacity + mode-branched eligibility.
 *
 * Sub-tab `bindings` inside the committees wizard step. The roster sub-tab
 * (existing `CategoryCommittees` set) is a prerequisite — a binding can
 * only be created when its committee is already in the roster for
 * (cycleId, applicantCategoryId). Day source is `examScheduleService`
 * filtered to `kind === 'WORKING'`.
 *
 * Mirrored in `docs/DB_CONSTRAINTS.md §13`.
 * ─────────────────────────────────────────────────────────────────────── */

/**
 * Mode-branched eligibility carried on a binding row. Branch tag mirrors
 * the parent category's `gradingMode` resolved via
 * `resolveCategoryGradingMode(categoryCode)`. The two branches are
 * mutually exclusive and the form picks the right one based on the
 * active category.
 */
export type BindingEligibility =
  | {
      gradeKind: 'GRADES';
      /** Inclusive percentage floor (0..100). */
      minPercentage: number;
      /** Inclusive percentage ceiling (0..100). `min ≤ max`. */
      maxPercentage: number;
    }
  | {
      gradeKind: 'TAGDIR';
      /** FK → lookup `academic-grades[code]`. Floor of the band. */
      minAcademicGradeId: string;
      /** FK → lookup `academic-grades[code]`. Ceiling of the band. Compared
       *  against `min` via `readPercentageRange(row).min`. */
      maxAcademicGradeId: string;
    };

export interface CommitteeDayBinding {
  id: string;
  cycleId: string;
  /** FK → `applicant-categories[CAT-NN].code`. */
  applicantCategoryId: string;
  /** FK → `Committee.id`. Must already appear in the cycle's
   *  `CategoryCommittees` rows for `applicantCategoryId`. */
  committeeId: string;
  /** FK → `ExamScheduleDay.id`. Must be `kind === 'WORKING'`. */
  examScheduleDayId: string;
  /** Per-cell seat capacity. Strictly positive integer. */
  capacity: number;
  /** Mode-branched eligibility — branch must match category gradingMode. */
  eligibility: BindingEligibility;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Conflict codes thrown by `committeeBindingService`. Surfaced as Arabic
 * toasts via the query layer. Mirrored in `docs/DB_CONSTRAINTS.md §13`.
 *
 * `PERCENTAGE_OUT_OF_RANGE` is re-used from the Application Settings
 * conflict set (same invariant, different copy); see
 * `shared/lib/errors.ts:ConflictCode`.
 */
export type BindingConflict =
  | 'DUPLICATE_BINDING'
  | 'CAPACITY_NOT_POSITIVE'
  | 'GRADE_RANGE_INVERTED'
  | 'PERCENTAGE_OUT_OF_RANGE'
  | 'TAGDIR_GRADE_NOT_FOUND'
  | 'MODE_MISMATCH'
  | 'DAY_NOT_WORKING'
  | 'COMMITTEE_WRONG_CATEGORY';

/** Uploaded PDF metadata for the electronic declaration. */
export interface DeclarationDocument {
  fileName: string;
  /** Object/blob URL or remote path the applicant-side opens for preview. */
  fileUrl: string;
  /** Bytes. Enforced ≤ 10 MB on save. */
  size: number;
}

/** Which surface the applicant sees on Stage 9 — rich-text body or PDF. */
export type DeclarationMode = 'text' | 'pdf';

/** Electronic declaration shown to the applicant on Stage 9.
 *
 * Both modes (rich text + PDF) coexist on every saved record so admins can
 * switch between tabs without losing the other tab's prior content.
 * `mode` selects which surface is published to applicants. */
export interface ElectronicDeclaration {
  id: string;
  cycleId: string;
  mode: DeclarationMode;
  /** Arabic body for `mode = 'text'`. Empty string when never authored. */
  bodyAr?: string;
  /** Uploaded PDF for `mode = 'pdf'`. Null when never uploaded. */
  document?: DeclarationDocument | null;
  /** Auto-incremented per save. */
  version: number;
  /** ISO date — declaration becomes binding from this date. */
  effectiveFrom: string;
  /** ISO date — set when the admin publishes (visible to applicants). */
  publishedAt?: string;
  createdAt: string;
  createdBy: string;
  /** Soft delete marker — kept for backend mirroring. */
  deletedAt?: string | null;
}
