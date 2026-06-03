/**
 * Cross-feature domain types — shapes used by mock-data and services.
 */

import type { AppKey } from '@/shared/lib/constants';

/**
 * Soft-delete mixin — Gap D (admin-gaps).
 *
 * Adds optional tombstone fields to entities that support soft delete.
 * `null` is the live state; an ISO `deletedAt` flips a row to soft-deleted.
 * `list()` services filter out soft-deleted rows by default; a super-admin
 * `includeDeleted` toggle restores them to view, never to use.
 *
 * Applicants and audit entries are explicitly excluded — applicants stay
 * around for cycle-history queries; audit entries are append-only.
 */
export interface SoftDeleteFields {
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
}

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
  fatherWives?: ApplicantFamilyMember[];
  motherHusbands?: ApplicantFamilyMember[];
  guardian?: ApplicantFamilyMember;
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
  /** Admin-controlled suspension flag; applicants may authenticate but cannot write while true. */
  suspended?: boolean;
  /** Free-text reason for any soft "موقوف" status applied by an admin. */
  suspensionReason?: string;
  /** Set when Stage 9 (attendance card print) has fired — locks personal data. */
  attendanceCardPrintedAt?: string;
}

export interface Applicant extends ApplicantExtended {
  id: string;
  /** Normalized SQL applicants.id, exposed for admin reconciliation screens. */
  applicantTableId?: string;
  /** Legacy admin_records id when the row was imported from the JSON store. */
  adminRecordId?: string;
  nationalId: string;
  name: string;
  gender: 'male' | 'female';
  birthDate: string;
  birthGovernorate?: string;
  birthDistrict?: string;
  phoneNumber?: string;
  email?: string;
  source?: string;
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
  | 'applicant.transition'
  /* Soft delete + restore (Gap D) */
  | 'soft_delete'
  | 'restore'
  /* Login security events (Gap A) */
  | 'login_success'
  | 'login_failed'
  | 'account_locked'
  | 'account_unlocked'
  | 'otp_sent'
  | 'otp_verified'
  | 'otp_failed'
  /* Cycle lifecycle (Gap F) */
  | 'cycle_activated'
  | 'cycle_deactivated'
  | 'cycle_closed'
  | 'cycle_extended'
  | 'cycle_archived'
  /* Category rule changes with override (Gap G) */
  | 'category_rules_changed'
  | 'category_rules_changed_with_override'
  /* Notification authoring (Gap L) */
  | 'notification_published'
  | 'notification_unpublished'
  /* Payment events (Gap K) */
  | 'payment_status_changed'
  | 'payment_refunded'
  /* Admin-create NID flow */
  | 'user_created'
  | 'user_updated'
  | 'user_status_changed'
  | 'user_roles_changed'
  /* Universal list-actions (Tasks/LIST_ACTIONS_PROMPT.md) */
  | 'entity_exported'
  | 'entity_imported'
  | 'entity_duplicated';
export type AuditColor = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Typed module taxonomy — used by Gap E filters and the withAudit() helper. */
export type AuditModule =
  | 'admin'
  | 'auth'
  | 'cycles'
  | 'categories'
  | 'committees'
  | 'lookups'
  | 'exams'
  | 'payments'
  | 'notifications'
  | 'roles'
  | 'users'
  | 'workflows'
  | 'applicants';

/**
 * Audit entry — Sprint 1 baseline plus Gap E (admin-gaps) extensions.
 *
 * Existing fields (`userId`, `userName`, `entity`, `timestamp`, …) are kept
 * for backwards compatibility with the 240 seeded mock entries and existing
 * UI consumers. New optional fields land alongside:
 *   - `role`: actor role at time of action
 *   - `module`: typed module taxonomy
 *   - `entityType`: typed entity name (Arabic-label-free)
 *   - `before` / `after`: per-row diff (replaces the side-table MOCK.auditDiffs
 *     for rows that ship them inline)
 *   - `deviceMeta`: optional UA/device hint
 *   - `at`: ISO mirror of `timestamp` (real backend will return ISO; mock
 *     populates both so consumers can pick either)
 */
export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  /** Actor role at time of action (Gap E). */
  role?: string;
  action: AuditAction;
  actionLabel: string;
  actionColor: AuditColor;
  /** Module taxonomy (Gap E filters). */
  module?: AuditModule;
  /** Arabic entity label (existing). */
  entity: string;
  /** Typed entity name (Gap E — `cycle`, `category`, `committee`, …). */
  entityType?: string;
  entityId: string;
  details: string;
  /** Inline before/after diff (Gap E). */
  before?: unknown;
  after?: unknown;
  timestamp: number;
  /** ISO timestamp mirror (Gap E). */
  at?: string;
  ip: string;
  deviceMeta?: string;
}

/** SystemUser status — Gap C (admin-gaps). `active` kept for backwards
 * compat; `status` is the typed primary going forward. */
export type SystemUserStatus = 'active' | 'suspended' | 'locked';

/** Binary admin-controlled account status — surfaced as the
 * Active / Inactive toggle in the user-creation flow. `inactive`
 * maps to `SystemUserStatus = 'suspended'` on persistence; `locked`
 * remains reserved for the failed-login lockout state from Gap A. */
export type AccountStatus = 'active' | 'inactive';

/** User-type taxonomy for the admin directory — surfaces in detail
 * views and may gate downstream provisioning logic. */
export type UserType = 'officer' | 'civilian' | 'contractor';

export interface SystemUser {
  id: string;
  /** Legacy display name — kept in sync with `fullArabicName` for the
   *  many existing consumers that read `u.name`. */
  name: string;
  /** Legacy single-role field — kept in sync with `roles[0]` for
   *  bulk-assign and other single-role consumers. */
  role: string;
  active: boolean;
  status?: SystemUserStatus;
  lastLogin: number;
  /* ── Admin-create NID flow extensions ─────────────────────────────── */
  /** 14-digit Egyptian National ID. Source of identity. */
  nationalId: string;
  /** 4-part Arabic name from the officer directory. */
  fullArabicName: string;
  /** Officer / admin code (e.g. "OFF-1001"). */
  officerCode: string;
  /** Contact mobile in local format. */
  mobileNumber: string;
  /** Officer / civilian / contractor categorisation. */
  userType: UserType;
  /** Multi-role assignment — role keys; narrowed to `Role` in feature code.
   *  Typed as `string[]` here to keep `shared/types` free of feature
   *  imports (Clean Arch). The legacy `role` field mirrors `roles[0]`. */
  roles: string[];
  /** Binary admin-controlled status — Active / Inactive. */
  accountStatus: AccountStatus;
  /** ISO timestamps — admin audit and ordering. */
  createdAt: string;
  updatedAt: string;
  /* ── MOI sign-in credentials ── */
  /** MOI sign-in username (generated on create). */
  username?: string;
  /** Whether the account holds an admin-issued temporary password. */
  mustChangePassword?: boolean;
  /** True once the account has a password set. */
  hasCredentials?: boolean;
  /** Transient — returned ONLY in the create response so the UI can reveal it. */
  generatedUsername?: string;
  /** Transient — plaintext one-time password, present only right after create/reset. */
  temporaryPassword?: string;
}

/* ── Dynamic roles + permission matrix — Gap C (admin-gaps) ──────────── */

/** Permission identifiers — `module:action` (e.g. `applicants:view`).
 *  System rows ship with the platform; admin can clone or extend. */
export type Permission = string;

export interface RoleDefinitionRow extends SoftDeleteFields {
  id: string;
  /** Stable key — used by `AuthUser.role` and the legacy 11-role union. */
  key: string;
  labelAr: string;
  labelEn?: string;
  /** True for the 11 seed roles + Finance Review; permissions/labels are
   *  read-only for system rows but `scope` can still be edited. */
  isSystem: boolean;
  permissions: Permission[];
  /** App access — same AppKey union as the legacy ROLE_DEFINITIONS. */
  apps: readonly AppKey[];
  /** Optional per-actor scoping (committee/department gating). */
  scope?: {
    committeeIds?: string[];
    departmentIds?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicalStation {
  id: string;
  name: string;
  doctor: string;
  queue: number;
  completed: number;
}

/**
 * Score-criteria configuration — Gap H (admin-gaps).
 * Captures the three score axes the meeting notes called out:
 * "magmo3" (cumulative score), "ta2deer" (grade tier),
 * "accumulative score for student".
 */
export interface CommitteeScoreCriteria {
  magmoo3?: { min: number; max: number };
  ta2deer?: ('ممتاز' | 'جيد جداً' | 'جيد' | 'مقبول')[];
  accumulativeScore?: { min: number; max: number };
}

/**
 * Committee dynamic rule — applicant routing constraint.
 *
 * Each rule narrows the set of applicants that can be auto-assigned to
 * the committee. All present fields are AND-combined: applicants must
 * satisfy every constraint (grade range, alphabetical range, gender,
 * applicant type) to qualify. Empty / undefined fields are "no
 * constraint" on that axis.
 */
export interface CommitteeRules {
  /** Inclusive numeric grade range (0–100). */
  gradeFrom?: number | null;
  gradeTo?: number | null;
  /** Inclusive academic-grade (تقدير) range. FKs into the `academic-grades`
   *  lookup. Compared at distribution time against the applicant's resolved
   *  تقدير when the parent category's gradingMode is TAGDIR. */
  academicGradeFromId?: string | null;
  academicGradeToId?: string | null;
  /** Arabic first-letter range, e.g. ('أ', 'د') — inclusive on both ends.
   *  Legacy. Retained on the type so seeded committees still filter; new
   *  committees no longer expose this in the create/edit form. */
  alphabetFrom?: string | null;
  alphabetTo?: string | null;
  /** Optional gender constraint for applicants this committee processes.
   *  Legacy — retained for seeded committees; no longer exposed in the
   *  create/edit form. */
  gender?: 'male' | 'female' | 'any';
  /**
   * Optional applicant-type constraint. Stable lookup key from the
   * `educationTypes` lookup (managed at /admin/reference-data/educationTypes),
   * or the literal `'any'` for no constraint. Stored as a free-form string
   * so admins can add new education types without a code change.
   */
  applicantType?: string;
}

export type CommitteeStatus = 'active' | 'inactive';

/**
 * CommitteeInstance — a cycle-bound, dated, capacity-bearing committee
 * assignment.
 *
 * Domain model: a committee has two surfaces.
 *
 *   1. **CommitteeDefinition** (the catalog) — the row in the
 *      `/admin/lookups/committees` lookup. Holds the committee's identity
 *      (name, applicantCategoryId) and is admin-managed cross-cycle.
 *      Lives at `features/lookups/types.ts → CommitteeRow` (re-exported
 *      as `CommitteeDefinition` from the lookups barrel for clarity).
 *
 *   2. **CommitteeInstance** (this type) — a cycle-scoped assignment that
 *      pairs a definition with a date + capacity. The admission-setup
 *      wizard creates instances; `/admin/committees-exam-config` lists and edits
 *      every instance across cycles.
 *
 * Authoring sites:
 *   - Wizard step `/admin/cycles/admission-setup/wizard/committees` creates
 *     instances from the picked category's definitions.
 *   - `/admin/committees-exam-config` management page lists, filters, sorts, and
 *     inline-edits date + capacity on every existing instance.
 *
 * Both sites operate on the same record — edits in either location update
 * the same entity.
 */
export interface CommitteeInstance {
  id: string;
  /** FK → lookups['committees'].code — the committee definition. */
  definitionCode: string;
  /** FK → AdmissionCycle.id — the cycle this instance is scoped to. */
  cycleId: string;
  /** FK → ApplicantCategory.key — the category this instance serves.
   *  Carried explicitly so cross-cycle filters don't have to round-trip
   *  through the definition row. Mirrors the parent definition's
   *  `applicantCategoryId`. */
  categoryKey: string;
  /** ISO yyyy-mm-dd date this instance sits on. */
  date: string;
  /** Seats for this instance on this date (1..999). */
  capacity: number;
  /** Seats currently reserved by scheduled applicants. Refreshed from the
   *  scheduling backend on demand (the management page's «تحديث» button
   *  invalidates the query). `reserved > capacity` is visually flagged
   *  on the management surface but never blocked at the data layer —
   *  over-reservation is observable, not corrected here. */
  reserved: number;
  /** ISO timestamp of the last time `reserved` was synced. Surfaces in
   *  the management page's «آخر تحديث» column so admins can tell whether
   *  the count they're looking at is stale. */
  reservedRefreshedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * ExamScheduleEntry — one (committee × date) row backing the
 * /admin/committee/schedule page. Added in batches from the page's
 * form: one entry per committee in the active category gets a row
 * with the chosen date + capacity. The list page reads these by
 * `categoryKey` (derived through the committee FK).
 */
export interface ExamScheduleEntry {
  id: string;
  committeeId: string;
  /** ISO yyyy-mm-dd date the committee sits on. */
  date: string;
  /** Per-day capacity for this committee on this date (1..999). */
  capacity: number;
}

/**
 * Acceptance-grade ladder used by `gradeType === 'tier'` committees.
 *
 * The values are display labels (Arabic) — the integer index in this
 * tuple is the canonical sortable value stored on `Committee.gradeMin`
 * / `Committee.gradeMax`.
 *
 *   0 = مقبول · 1 = جيد · 2 = جيد جدًا · 3 = امتياز · 4 = امتياز مع مرتبة الشرف
 */
export const GRADE_TIERS = [
  'مقبول',
  'جيد',
  'جيد جدًا',
  'امتياز',
  'امتياز مع مرتبة الشرف',
] as const;
export type GradeTier = (typeof GRADE_TIERS)[number];

/**
 * Discriminates how a committee's acceptance band is encoded:
 *   `score` — numeric percentage (0..100). gradeMin/gradeMax are %.
 *   `tier`  — categorical تقدير. gradeMin/gradeMax are indices into
 *             `GRADE_TIERS` (0..GRADE_TIERS.length - 1).
 */
export type CommitteeGradeType = 'score' | 'tier';

export interface Committee extends SoftDeleteFields {
  id: string;
  name: string;
  head: string;
  members: number;
  applicants: number;
  completed: number;
  /** FK → `applicant-categories[CAT-NN].code`. Required — the list page
   *  groups committees under their category header. */
  categoryKey: string;
  /** Total seats this committee can absorb. Required (1..999). */
  capacity: number;
  /** Discriminator for `gradeMin` / `gradeMax`. */
  gradeType: CommitteeGradeType;
  /** Inclusive lower bound. `score`: 0..100 percentage; `tier`: index
   *  into `GRADE_TIERS` (0..4). */
  gradeMin: number;
  /** Inclusive upper bound. Same units as `gradeMin`. */
  gradeMax: number;
  /* ── Admin module enhancements ────────────────────────────────── */
  /** Committee head — user id (when assigned from the eligible-officers list). */
  headUserId?: string;
  /** Academic year identifier (e.g. "2026-2027"). */
  academicYearId?: string;
  /** Active / inactive (admin toggle). */
  status?: CommitteeStatus;
  /** ISO timestamp — created date. */
  createdAt?: string;
  /** Specialization ids (RefSpecialization.id) bound to this committee. */
  specializationIds?: string[];
  /** Dynamic rule bag — see CommitteeRules. */
  rules?: CommitteeRules;

  /* ── Gap H additions (admin-side configuration) ───────────────── */
  /** Gender restriction for committee membership. */
  gender?: 'male' | 'female' | 'any';
  scoreCriteria?: CommitteeScoreCriteria;
  /** Daily attendance ceiling — capacity check rejects when met. */
  capacityPerDay?: number;
  /** Working dates the committee accepts applicants on (ISO date strings). */
  availableDates?: string[];
  linkedCycleId?: string;
  linkedCategoryIds?: ApplicantCategoryKey[];
  linkedExamIds?: string[];
  /** Lookup key for sorting criteria — driven from rejectionReasons or similar. */
  sortingCriteria?: string;
  /** System users with `committee_admin` / `committee_user` role assigned to this committee. */
  officerIds?: string[];
  /** Specialty/degree/faculty/university scoping ids (driven by Gap I lookups). */
  scopedSpecialtyIds?: string[];
  scopedDegreeIds?: string[];
  scopedFacultyIds?: string[];
  scopedUniversityIds?: string[];
}

/**
 * CategoryCommittees — relationship entity binding an admission committee
 * to an applicant category for a given academic year. Drives the
 * admission-setup wizard committee picker and constrains the applicant
 * distribution stage to committees explicitly enrolled in the cycle.
 *
 * INTEGRATION CONTRACT mirrors the proposed SQL Server table:
 *   PK (id)
 *   UNIQUE (CategoryId, CommitteeId, AcademicYearId)
 *   FK CategoryId   → ApplicantCategory.key
 *   FK CommitteeId  → Committee.id
 */
export interface CategoryCommittees {
  id: string;
  categoryId: ApplicantCategoryKey;
  committeeId: string;
  academicYearId: string;
  /** Cycle the binding was created inside — lets the wizard scope by cycle. */
  cycleId: string;
  /** Display rank inside the cycle's committee list (lower → earlier). */
  order?: number;
  createdAt: string;
  createdBy: string;
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

/* ── Applicant categories — RFP §2.1 (4 categories, closed set) ───────
 *
 * The RFP Scope Document defines exactly 4 categories. No admin-defined
 * custom categories are permitted. The derived union is the source of
 * truth for every consumer that needs to type a category key. Keep this
 * tuple in sync with the lookup seed at
 * `features/lookups/mock/lookups.mock.ts` §9.
 *
 *   officers_general              — قسم الضباط (قسم عام)         — ذكور فقط
 *   law_bachelor                  — ليسانس حقوق                  — مختلط
 *   physical_education_bachelor   — بكالوريوس تربية رياضية       — إناث فقط
 *   specialized_officers          — الضباط المتخصصون             — مختلط
 *
 * Migration history: replaces the legacy 7-key set (added the two
 * bachelor tracks; retired postgraduate + the 3 institutes + special_units;
 * renamed `officers_specialized` → `specialized_officers`). See
 * docs/migration/admission-categories-rfp/AUDIT.md.
 */

export const APPLICANT_CATEGORY_KEYS = [
  'officers_general',
  'law_bachelor',
  'physical_education_bachelor',
  'specialized_officers',
] as const;

export type ApplicantCategoryKey = (typeof APPLICANT_CATEGORY_KEYS)[number];

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

/**
 * Expanded admin-side condition bag — Gap G (admin-gaps).
 *
 * Sits alongside the existing `CategoryCondition` (singular) which serves
 * the applicant-portal eligibility check. The plural `CategoryConditions`
 * captures the richer matrix the meeting notes called out (multi-select
 * education-types and marital-statuses, required-document checklist,
 * required-exam IDs, examOrder). Optional on `ApplicantCategory` so existing
 * seeded rows keep typechecking.
 */
export interface CategoryConditions {
  gender: 'male' | 'female' | 'any';
  minAge: number | null;
  maxAge: number | null;
  /** ISO date used to evaluate age. Falls back to cycle.ageCalcDate. */
  ageCalcDate?: string;
  /** Lookup keys (`thanaweya_amma`, `azhar`, …) — driven by educationTypes lookup. */
  educationTypes: string[];
  /** Optional graduation-year filter; null = any. */
  graduationYear?: number | null;
  /** Lookup keys (`single`, `married`, …) — driven by maritalStatuses lookup. */
  maritalStatuses: string[];
  minScore?: number | null;
  /** Free-text required-document checklist. */
  requiredDocuments: string[];
  /** Required exam ids — driven by examTypes lookup or examConfigs. */
  requiredExamIds: string[];
  /** Ordered exam ids — drives the per-cycle exam plan in Gap J. */
  examOrder: string[];
}

export interface ApplicantCategory extends SoftDeleteFields {
  key: ApplicantCategoryKey;
  labelAr: string;
  labelEn: string;
  description: string;
  /** Computed snapshot from `MOCK.activeCycleId → cycle.openCategories[key]`. */
  isOpen: boolean;
  conditions: CategoryCondition;
  /** Gap G expanded condition matrix (admin-side rule builder). */
  expandedConditions?: CategoryConditions;
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

/* ── Reference data row shapes — Sprint 1 (Tasks/KARASA_GAPS.md §1.2.B)
 * ───
 *
 * The `LookupKey` / `LookupRow` / `ReferenceTab` / `ReferenceRowMap`
 * types previously sat here. They were retired by the Lookup Management
 * Module migration (see features/lookups/types.ts and
 * docs/migration/lookups/REPORT.md). The Ref* interfaces below survive
 * because non-admin pickers (applicant portal, board, ApplicantForm)
 * still consume the raw REF_* const arrays for static option sources.
 */

export interface RefGovernorate extends SoftDeleteFields {
  id: string;
  nameAr: string;
  nameEn: string;
  region: 'cairo' | 'delta' | 'canal' | 'upper' | 'frontier';
  active: boolean;
}

export interface RefSpecialization extends SoftDeleteFields {
  id: string;
  nameAr: string;
  code: string;
  facultyType: 'civil' | 'military' | 'sciences';
  active: boolean;
}

export interface RefRank extends SoftDeleteFields {
  id: string;
  nameAr: string;
  level: number;
  applicableTo: 'officer' | 'enlisted' | 'civilian';
}

export interface RefNationality extends SoftDeleteFields {
  id: string;
  nameAr: string;
  nameEn: string;
  isoCode: string;
}

export interface RefRelationship extends SoftDeleteFields {
  id: string;
  nameAr: string;
  degree: 1 | 2 | 3 | 4;
  side: 'paternal' | 'maternal' | 'spouse' | 'self';
}

export interface RefCaseType extends SoftDeleteFields {
  id: string;
  nameAr: string;
  severity: 'low' | 'medium' | 'high';
  blocksApplication: boolean;
}

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

export type CycleStatus =
  | 'draft'
  | 'open'
  | 'active'
  | 'extended'
  | 'closed'
  | 'processing'
  | 'finalized'
  | 'archived';

/**
 * Fawry payment config — Gap K (admin-gaps).
 * Cycle-level integration parameters; editable from the cycle detail.
 */
export interface FawryConfig {
  /** Issuer-side merchant code provided to the academy. */
  merchantCode: string;
  /** UI label rendered next to the Fawry payment option. */
  label: string;
  /** Window during which a payment can be retried before voiding. */
  retryWindowHours: number;
}

/**
 * Per-cycle fee schedule — Gap F (admin-gaps).
 * Application fee is required; deposit / replacement / late fees are optional
 * because not every cycle exercises them. Typed numeric so tnum tabular
 * numerals format consistently across UI.
 */
export interface CycleFees {
  applicationFee: number;
  /** Optional refundable deposit (per RFP §p.42 صلاحية إعادة المقابل المالي). */
  depositFee?: number;
  /** Replacement card / ID printout fee. */
  replacementFee?: number;
  /** Late application fee — applied during the extension window. */
  lateFee?: number;
  /** Fawry-specific integration config — Gap K. */
  fawryConfig?: FawryConfig;
}

/* ── Admin-side Fawry payment record — Gap K (admin-gaps) ─────────────── */

export type FawryPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export interface AdminPaymentRow {
  id: string;
  applicantId: string;
  applicantName: string;
  nationalId: string;
  cycleId: string;
  fawryReference: string;
  amount: number;
  status: FawryPaymentStatus;
  /** ISO timestamp of last Fawry sync. */
  lastSyncAt: string;
  /** ISO timestamp of payment success (if paid). */
  paidAt?: string;
}

export interface AdmissionCycleCategoryConfig {
  isOpen: boolean;
  capacity: number | null;
  notes: string;
  /**
   * Genders allowed to apply to this category within this cycle. Multi-select
   * over `'male' | 'female'`. Optional for backwards compatibility with
   * cycles seeded before the field existed; required (non-empty) when
   * `isOpen === true` — validated server-side in `cyclesService.toggleCategory`
   * and inline in the إعدادات التقديم step.
   */
  genderTypes?: ('male' | 'female')[];
  /** ISO date (YYYY-MM-DD) — first day this category accepts applications.
   *  Required when `isOpen === true`; must fall inside the cycle's
   *  [openDate, closeDate] window (the academic year for this cohort). */
  startDate?: string | null;
  /** ISO date (YYYY-MM-DD) — last day this category accepts applications.
   *  Required when `isOpen === true`; must be `>= startDate` and inside the
   *  cycle's [openDate, closeDate] window. */
  endDate?: string | null;
}

export interface AdmissionCycle extends SoftDeleteFields {
  id: string;
  nameAr: string;
  /** Year + cohort marker, e.g. 2026-male / 2026-female. */
  cohort: 'male' | 'female';
  year: number;
  openDate: string; // ISO
  closeDate: string; // ISO
  /**
   * Reference date used to evaluate age-based eligibility — Gap F.
   * Defaults to `closeDate` when missing. Stored separately because
   * extensions may move closeDate without changing the eligibility cutoff.
   */
  ageCalcDate?: string;
  /**
   * Reference age (in full years) the cycle is calibrated against, paired
   * with `ageCalcDate`. Optional UI affordance on the cycle metadata step;
   * Step 4 (شروط السن) still owns the per-category min/max range.
   */
  referenceAge?: number;
  /** Per-cycle fee schedule (Gap F). */
  fees?: CycleFees;
  /** Categories opened in this cycle (Gap F derived view). */
  linkedCategoryIds?: ApplicantCategoryKey[];
  /** Committees scheduled to handle applicants from this cycle (Gap F + H). */
  linkedCommitteeIds?: string[];
  /** Ordered exam keys to be administered (Gap F + J). */
  examOrder?: string[];
  expectedCapacity: number;
  applicantCount: number;
  status: CycleStatus;
  /**
   * Active flag — orthogonal to `status`. At most ONE cycle in the system
   * may have `isActive === true`; the cycles service enforces the invariant
   * atomically (see `cyclesService.setActive`). A draft cycle (status:
   * 'review' in cycles-UI terms) can still be marked active; conversely a
   * published cycle can be inactive (e.g. historical). The cycles list
   * surfaces this as a dedicated "نشطة / غير نشطة" column.
   *
   * Optional for backwards compatibility with seeded data; treat missing
   * as `false`.
   */
  isActive?: boolean;
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
  maritalStatus: ReadonlyArray<'single' | 'married'>;
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
  /** Category the applicant selected on /applicant/start. */
  categoryKey?: string;
  auth?: {
    nationalId: string;
    phoneNumber: string;
    smsVerifiedAt?: number;
  };
  personal?: Record<string, unknown>;
  education?: Record<string, unknown>;
  marital?: Record<string, unknown>;
  /** Profile payload saved by Stage 3 (Stage345ApplicantDataPage). */
  profile?: {
    shuhra?: string;
    maritalStatus?: 'single' | 'married';
    addressGovernorate?: string;
    addressDistrict?: string;
    currentAddressDetail?: string;
    homePhone?: string;
    secondaryMobile?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
    schoolNameAr?: string;
    schoolAddress?: string;
    thanawiCountry?: string;
    thanawiTotal?: number;
    thanawiPercentage?: number;
    thanawiType?: string;
    thanawiGradDate?: string;
    bachelorFaculty?: string;
    bachelorUniversity?: string;
    bachelorMajor?: string;
    bachelorBranch?: string;
    bachelorSpecialization?: string;
    bachelorPercentage?: number;
    bachelorYear?: number;
    [key: string]: unknown;
  };
  payment?: {
    method: 'fawry' | 'card' | 'fawry-code';
    fawryCode?: string;
    refNumber?: string;
    amount?: number;
    paidAt?: number;
  };
  family?: Record<string, unknown>;
  /** Set after POST /applicant/parents/approve succeeds. */
  parentsApproved?: boolean;
  parentsApprovedAt?: number;
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
  /** Fawry-side payment reference (the number printed on the attendance card).
   *  Only set when method === 'fawry'. */
  fawryCode?: string;
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

/* ── Cycle category exam plan — Gap J (admin-gaps) ───────────────────
 *
 * Per-cycle, per-category ordered list of exams. Drives:
 *   - the order applicants take exams
 *   - per-exam fees (when cycle.fees has multiple line items)
 *   - whether the exam is required (vs supplementary)
 *
 * Copy-from-previous-cycle uses `examsService.copyConfig` to clone an
 * entire cycle's plans into a new draft cycle.
 */

export type ExamScoreType = 'numeric' | 'pass_fail' | 'qualitative';

export interface AcademyExam extends SoftDeleteFields {
  id: string;
  /** Lookup-style stable key — joined to the examTypes lookup. */
  key: string;
  group: string;
  nameAr: string;
  scoreType: ExamScoreType;
  /** When false, the exam is supplementary (failure does not block). */
  isQualifying: boolean;
}

export interface CycleCategoryExamPlanEntry {
  examId: string;
  order: number;
  fee?: number;
  isRequired: boolean;
}

export interface CycleCategoryExamPlan {
  id: string;
  cycleId: string;
  categoryId: ApplicantCategoryKey;
  exams: CycleCategoryExamPlanEntry[];
  updatedAt?: string;
}

/** Result-approval state machine — Gap J. */
export type ExamResultStatus = 'draft' | 'review' | 'approved' | 'published';

/* ── Question Bank & e-Exams — Sprint 7 (RFP Scope Document §9) ────────────────── */

export type QuestionType = 'mcq' | 'true-false' | 'matching' | 'ordering' | 'fill-in';
export type QuestionStatus = 'draft' | 'review' | 'approved' | 'live';

export interface MatchingPair {
  prompt: string;
  match: string;
}

export interface BankQuestion {
  id: string;
  category: string;
  classification?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  type: QuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  matchingPairs?: MatchingPair[];
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
  cycleName?: string;
  scheduledFor: string;
  accessStartAt?: string;
  accessEndAt?: string;
  durationMinutes?: number;
  questionCount?: number;
  randomSelection?: boolean;
  randomQuestionOrder?: boolean;
  displayMode?: 'full-page' | 'one-question';
  assignedCategories?: string[];
  assignedTypes?: string[];
  assignedGenders?: Array<'male' | 'female'>;
  assignedSpecializations?: string[];
  reopenedApplicantIds?: string[];
  /** Public exam-room token used by `/exam-room/:token`. */
  publishToken?: string;
  /** Full public URL copied by admins after publishing. */
  publishedUrl?: string;
  /** IP allowlist for real exam-room access. Supports exact IPs and `*` octet wildcards. */
  allowedIps?: string[];
  rules: { category: string; difficultyMin: number; difficultyMax: number; count: number; minutes: number }[];
  questionIds: string[];
  status: 'draft' | 'published' | 'stopped' | 'completed';
}

export interface ExamAttempt {
  id: string;
  examId: string;
  applicantId: string;
  startedAt: number;
  submittedAt?: number;
  answers: Record<string, ExamAnswer>;
  flagged: string[];
  score?: number;
  passFail?: 'pass' | 'fail';
  resultState?: ElectronicExamResultStatus;
  approvedAt?: number;
  publishedAt?: number;
  deviceId?: string;
  ipAddress?: string;
}

export type ExamAnswer = number | Record<string, string>;

export type ExamCommitteePermission =
  | 'system-admin'
  | 'committee-manager'
  | 'proctor'
  | 'question-editor'
  | 'results-approver'
  | 'reports-viewer';

export interface ExamCommitteeUser {
  id: string;
  fullName: string;
  username: string;
  passwordMask: string;
  permission: ExamCommitteePermission;
  examType: string;
  status: 'active' | 'suspended';
  authorizedDeviceId: string;
  authorizedIp: string;
}

export interface ExamAuthorizedDevice {
  id: string;
  label: string;
  macAddress: string;
  ipAddress: string;
  status: 'active' | 'inactive';
  allowedFrom: string;
  allowedTo: string;
  examId?: string;
}

export interface ExamAccessValidationRequest {
  nationalId: string;
  applicantCode: string;
  examId: string;
  ipAddress: string;
  deviceIdentifier: string;
}

export interface ExamAccessValidationResult {
  ok: boolean;
  applicantId?: string;
  examId?: string;
  attemptId?: string;
  reason?: string;
  checks: Array<{ key: string; label: string; ok: boolean; detail: string }>;
}

export type ElectronicExamResultStatus =
  | 'draft'
  | 'submitted'
  | 'preliminary'
  | 'approved'
  | 'published';

export type ExamResultState = ElectronicExamResultStatus;
export type AuthorizedExamDevice = ExamAuthorizedDevice;

export interface ElectronicExamResult {
  id: string;
  examId: string;
  attemptId: string;
  applicantId: string;
  applicantName: string;
  score: number;
  maxScore: number;
  percentage: number;
  passFail: 'pass' | 'fail';
  status: ElectronicExamResultStatus;
  submittedAt: string;
  approvedAt?: string;
  publishedAt?: string;
}

export type ExamAuditAction =
  | 'question.created'
  | 'question.edited'
  | 'question.hidden'
  | 'question.shown'
  | 'question.imported'
  | 'exam.created'
  | 'exam.published'
  | 'exam.stopped'
  | 'attempt.opened'
  | 'applicant.started'
  | 'applicant.submitted'
  | 'applicant.auto_submitted'
  | 'result.approved'
  | 'result.published';

export interface ExamAuditRecord {
  id: string;
  user: string;
  timestamp: string;
  action: ExamAuditAction;
  entity: string;
  entityId: string;
  previousValue?: string;
  newValue?: string;
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
  matchingPairs?: MatchingPair[];
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

/* ── Admin-authored notifications — Gap L (admin-gaps) ───────────────── */

export type AdminNotificationType = 'general' | 'student' | 'department' | 'category' | 'committee';

export type AdminNotificationStatus = 'draft' | 'scheduled' | 'published' | 'expired';

/**
 * Discriminated audience selector. Each shape carries the typed targeting
 * data the AudienceSelector UI needs:
 *  - `general` — broadcast to all applicants (no further data).
 *  - `student` — single applicant by nationalId (or applicantId).
 *  - `department` / `category` / `committee` — multi-select against lookups.
 */
export type AudienceSelector =
  | { type: 'general' }
  | { type: 'student'; nationalId: string; applicantId?: string }
  | { type: 'department'; departmentIds: string[] }
  | { type: 'category'; categoryKeys: ApplicantCategoryKey[] }
  | { type: 'committee'; committeeIds: string[] };

export interface AdminNotification extends SoftDeleteFields {
  id: string;
  type: AdminNotificationType;
  titleAr: string;
  bodyAr: string;
  /** Array — the notification matches an applicant if ANY entry matches.
   *  Persists multi-audience routing (e.g. "category X" + "committee Y").
   *  Empty array is treated as `[{ type: 'general' }]`. */
  audience: AudienceSelector[];
  /** ISO publish time — when reached, status flips draft → published. */
  publishAt: string;
  /** ISO expiry time — when reached, status flips published → expired. */
  expireAt?: string;
  /** Computed by `notificationsService.computeStatus`; persisted for sort. */
  status: AdminNotificationStatus;
  createdBy: string;
  createdAt: string;
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
