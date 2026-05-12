/**
 * Lookup Management Module — domain types.
 *
 * 18 distinct lookups, each with its own row shape. Modeled as a
 * discriminated union via `LookupRowMap[K]` so callers can do
 * `useLookup('governorates')` and get the right per-row type without
 * downcasting.
 *
 * Source of truth for the lookup set: the RFP scope document
 * (تطوير المنظومة المعلوماتية بأكاديمية الشرطة — الكراسة والمواصفات
 * الفنية 28-2-26). Seed values come from the PDF where it enumerates,
 * and from published Egypt Police Academy / Ministry of Interior /
 * Wikipedia (Arabic) sources where it only references.
 */

/* ─── The 18 lookups, in display order ───────────────────────────────── */

export const LOOKUP_KEYS = [
  'relationships',
  'relationship-degree-tiers',
  'faculties',
  'specializations',
  'tests',
  'test-results',
  'committees',
  'submission-types',
  'applicant-categories',
  'nationalities-countries',
  'governorates',
  'police-stations',
  'jobs',
  'qualifications',
  'announcements',
  'applicant-divisions',
  'school-categories',
  'nid-missing-reasons',
  'universities',
  'marital-statuses',
  'academic-grades',
] as const;

export type LookupKey = (typeof LOOKUP_KEYS)[number];

/* ─── Section grouping for the tab rail ──────────────────────────────── */

/* Five sections: kinship, الكليات, التخصصات (separate per the spec —
 * the user wants each as its own "main lookup section"), the residual
 * process bucket, and geography/admin references. */
export const LOOKUP_SECTIONS = [
  {
    key: 'kinship',
    label: 'علاقات وشجرة العائلة',
    keys: ['relationships', 'relationship-degree-tiers'] as const,
  },
  {
    key: 'faculties',
    label: 'الكليات',
    keys: ['faculties'] as const,
  },
  {
    key: 'specializations',
    label: 'التخصصات',
    keys: ['specializations'] as const,
  },
  {
    key: 'process',
    label: 'العملية والمحتوى',
    keys: [
      'tests',
      'test-results',
      'committees',
      'submission-types',
      'applicant-categories',
      'announcements',
      'applicant-divisions',
      'school-categories',
      'marital-statuses',
      'academic-grades',
    ] as const,
  },
  {
    key: 'geography',
    label: 'المراجع الجغرافية والإدارية',
    keys: [
      'nationalities-countries',
      'governorates',
      'police-stations',
      'jobs',
      'qualifications',
      'nid-missing-reasons',
      'universities',
    ] as const,
  },
] as const;

/* ─── Arabic labels + code prefix per key ────────────────────────────── */

export const LOOKUP_META: Record<LookupKey, { label: string; codePrefix: string; padding: number }> = {
  'relationships':                { label: 'صلات القرابة',                 codePrefix: 'REL', padding: 3 },
  'relationship-degree-tiers':    { label: 'فئات درجات القرابة',           codePrefix: 'RDT', padding: 1 },
  'tests':                        { label: 'الاختبارات والقبول',           codePrefix: 'TST', padding: 2 },
  'test-results':                 { label: 'نتائج الاختبارات',             codePrefix: 'RES', padding: 2 },
  'committees':                   { label: 'اللجان',                       codePrefix: 'CMT', padding: 2 },
  'specializations':              { label: 'التخصصات',                     codePrefix: 'SPC', padding: 2 },
  'faculties':                    { label: 'الكليات',                      codePrefix: 'FAC', padding: 2 },
  'submission-types':             { label: 'نوع التقديم',                  codePrefix: 'SUB', padding: 2 },
  'applicant-categories':         { label: 'فئات المتقدمين',               codePrefix: 'CAT', padding: 2 },
  'nationalities-countries':      { label: 'الجنسيات والدول',              codePrefix: 'CNT', padding: 3 },
  'governorates':                 { label: 'المحافظات',                    codePrefix: 'GOV', padding: 2 },
  'police-stations':              { label: 'أقسام ومراكز الشرطة',          codePrefix: 'PST', padding: 4 },
  'jobs':                         { label: 'الوظائف وفئاتها',              codePrefix: 'JOB', padding: 3 },
  'qualifications':               { label: 'المؤهلات',                     codePrefix: 'QUA', padding: 2 },
  'announcements':                { label: 'التنبيهات العامة للتقدم',      codePrefix: 'ANN', padding: 2 },
  'applicant-divisions':          { label: 'شعبة المتقدمين',               codePrefix: 'DIV', padding: 2 },
  'school-categories':            { label: 'فئة المدرسة',                  codePrefix: 'SCH', padding: 2 },
  'nid-missing-reasons':          { label: 'أسباب تعذر وجود رقم قومي',    codePrefix: 'NMR', padding: 2 },
  'universities':                 { label: 'الجامعات',                      codePrefix: 'UNI', padding: 2 },
  'marital-statuses':             { label: 'الحالة الاجتماعية',            codePrefix: 'MAR', padding: 2 },
  'academic-grades':              { label: 'التقدير الأكاديمي',             codePrefix: 'AGR', padding: 2 },
};

/* ─── Per-row base ───────────────────────────────────────────────────── */

export interface LookupRowBase {
  code: string;
  /** Arabic display name. */
  name: string;
  isActive: boolean;
  /** Generic carrier for lookups that need configuration not worth a
   *  typed column (e.g. `submission-types` stores `gradingMode` here).
   *  Per-key accessors live under `features/lookups/lib/*`. */
  metadata?: Record<string, unknown>;
}

/* ─── Per-key row shapes ─────────────────────────────────────────────── */

export type RelationshipBranch = 'paternal' | 'maternal' | 'self' | 'spouse' | 'none';
export type RelationshipGender = 'male' | 'female' | 'any';

export interface RelationshipRow extends LookupRowBase {
  /** Self-referential — builds the relationship tree (4 degrees). */
  parentCode: string | null;
  branch: RelationshipBranch;
  gender: RelationshipGender;
  /** Distance from self in the tree (1-4). Computed at seed time. */
  degree: 1 | 2 | 3 | 4;
}

export interface RelationshipDegreeTierRow extends LookupRowBase {
  degreeRange: string;
  maxDegree: 1 | 2 | 3 | 4;
}

export type TestKind = 'physical' | 'medical' | 'interview' | 'written' | 'psych';

export interface TestRow extends LookupRowBase {
  kind: TestKind;
  /** Sequence order within the admission pipeline. */
  order: number;
  required: boolean;
}

export type TestResultOutcome = 'pass' | 'fail' | 'defer' | 'withdrawn';
export type TestResultTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface TestResultRow extends LookupRowBase {
  outcome: TestResultOutcome;
  tone: TestResultTone;
}

export type CommitteeKind = 'primary' | 'medical' | 'final' | 'capacities' | 'traits' | 'sports' | 'interview';

export interface CommitteeRow extends LookupRowBase {
  kind: CommitteeKind;
  chairTitle: string;
}

export interface FacultyRow extends LookupRowBase {}

/** Specialization belongs to exactly one faculty (FK → `faculties`).
 *  Previously this was a many-to-many junction; collapsed into a direct
 *  FK because the codebase only ever needed a single faculty per
 *  specialization. */
export interface SpecializationRow extends LookupRowBase {
  facultyCode: string;
}

/** Submission-mode lookup. Each row's `metadata.gradingMode` flips a
 *  downstream branch (numeric درجات vs qualitative تقدير) on every
 *  applicant-category FK'd to it. Accessor lives at
 *  `features/lookups/lib/submissionType.ts` — read via `readGradingMode(row)`
 *  rather than reaching into `metadata` directly.
 *
 *  `nameEn` mirrors the bilingual approach used by `ApplicantCategoryRow`;
 *  `sortOrder` drives display order in the reference-data grid (10/20/30/40
 *  in the seed so admin can insert between later without re-keying). */
export interface SubmissionTypeRow extends LookupRowBase {
  nameEn: string;
  sortOrder: number;
}

export type ApplicantCategoryGenderScope = 'male' | 'female' | 'any';
export type ApplicantCategoryApplicationMode = 'general' | 'nomination';

/* Educational stage at which the applicant enters. Pre-University is the
 * Thanaweya track (officers_general); University covers the three bachelor
 * tracks (law / physical-education / specialized). */
export type ApplicantCategoryType = 'pre_university' | 'university';

/* For University-type categories only: whether the applicant picks a single
 * faculty or selects across multiple. Pre-University rows carry `null`. */
export type FacultySelectionType = 'single' | 'multiple';

/* The applicant-category lookup absorbs the full ApplicantCategory shape
 * — description, isOpen flag, conditions, expanded conditions, required
 * tests, procedures. This lookup is the single source of truth for
 * categories; the former /admin/categories page and MOCK.categories are
 * being retired in favour of it. Rich fields imported from
 * @/shared/types/domain (CategoryCondition etc.) so the existing
 * applicant-portal eligibility flow keeps working unchanged. */
import type {
  CategoryCondition,
  CategoryConditions,
  RequiredTest,
} from '@/shared/types/domain';

export interface ApplicantCategoryRow extends LookupRowBase {
  genderScope: ApplicantCategoryGenderScope;
  applicationMode: ApplicantCategoryApplicationMode;
  /** Entry stage — Pre-University (Thanaweya) vs University (bachelor). */
  type: ApplicantCategoryType;
  /** Faculty-picker shape. `null` when `type === 'pre_university'`. */
  facultySelectionType: FacultySelectionType | null;
  /** English label — used by some applicant-portal English copies. */
  nameEn: string;
  description: string;
  /** Open in the cycle. Snapshot of the cycle's `openCategories[code]`. */
  isOpen: boolean;
  conditions: CategoryCondition;
  expandedConditions?: CategoryConditions;
  requiredTests: RequiredTest[];
  procedures: string[];
}

export interface NationalityCountryRow extends LookupRowBase {
  /** ISO 3166-1 alpha-2. */
  iso2: string;
  isArab: boolean;
}

export type GovernorateRegion = 'الوجه البحري' | 'الوجه القبلي' | 'القاهرة الكبرى' | 'الحدود' | 'القناة';

export interface GovernorateRow extends LookupRowBase {
  region: GovernorateRegion;
}

export type PoliceStationKind = 'قسم' | 'مركز' | 'بندر';

export interface PoliceStationRow extends LookupRowBase {
  /** FK → `governorates`. */
  governorateCode: string;
  kind: PoliceStationKind;
}

export interface JobRow extends LookupRowBase {
  /** Self-referential: null on a category row, non-null on a job row
   *  pointing at its category. Bundling jobs + categories in one
   *  lookup keeps the count at 18 (per spec) and lets the UI render
   *  categories as parent nodes inline. */
  parentCode: string | null;
}

export type QualificationLevel = 'ثانوي' | 'دبلوم' | 'بكالوريوس' | 'ماجستير' | 'دكتوراه';
export type QualificationTrack = 'عام' | 'أزهري' | 'وافد' | 'أجنبي' | 'حقوق' | 'خاص';

export interface QualificationRow extends LookupRowBase {
  level: QualificationLevel;
  track: QualificationTrack;
}

export type AnnouncementGender = 'male' | 'female' | 'any';

export interface AnnouncementRow extends LookupRowBase {
  /** FK → `applicant-categories`, or `null` for all-categories. */
  categoryCode: string | null;
  gender: AnnouncementGender;
  /** FK → `applicant-divisions`, or `null` for all-divisions. */
  divisionCode: string | null;
  /** ISO datetime — start of publish window. */
  publishAt: string;
  /** ISO datetime — end of publish window. `null` = open-ended. */
  expireAt: string | null;
  /** Arabic body. */
  body: string;
}

export interface ApplicantDivisionRow extends LookupRowBase {}

export interface SchoolCategoryRow extends LookupRowBase {}

export interface NidMissingReasonRow extends LookupRowBase {
  /** If true, the eligibility flow forces the applicant to upload
   *  supporting documents for the rejected NID claim. */
  requiresUpload: boolean;
}

/** Egyptian universities — standalone lookup, no FK to other lookups. */
export interface UniversityRow extends LookupRowBase {}

/** Marital-status lookup row. Replaces the in-feature placeholder at
 *  `admission-setup/lib/maritalStatuses.ts` — the placeholder re-exports
 *  these rows so its existing call sites keep working. */
export interface MaritalStatusRow extends LookupRowBase {
  nameEn: string;
}

/** Academic-grade lookup row (التقدير). Used by the application-settings
 *  year row when the parent category's submission-type has
 *  `gradingMode = 'TAGDIR'`. The inclusive percentage range carried on
 *  `metadata.minPercentage` / `metadata.maxPercentage` lets the UI show a
 *  hint under the picked تقدير ("85–100%"). Accessor lives at
 *  `features/lookups/lib/academicGrade.ts` — `readPercentageRange(row)`. */
export interface AcademicGradeRow extends LookupRowBase {
  nameEn: string;
}

/* ─── Mapped type: discriminated union over LookupKey ─────────────── */

export interface LookupRowMap {
  'relationships': RelationshipRow;
  'relationship-degree-tiers': RelationshipDegreeTierRow;
  'tests': TestRow;
  'test-results': TestResultRow;
  'committees': CommitteeRow;
  'specializations': SpecializationRow;
  'faculties': FacultyRow;
  'submission-types': SubmissionTypeRow;
  'applicant-categories': ApplicantCategoryRow;
  'nationalities-countries': NationalityCountryRow;
  'governorates': GovernorateRow;
  'police-stations': PoliceStationRow;
  'jobs': JobRow;
  'qualifications': QualificationRow;
  'announcements': AnnouncementRow;
  'applicant-divisions': ApplicantDivisionRow;
  'school-categories': SchoolCategoryRow;
  'nid-missing-reasons': NidMissingReasonRow;
  'universities': UniversityRow;
  'marital-statuses': MaritalStatusRow;
  'academic-grades': AcademicGradeRow;
}

export type LookupRow<K extends LookupKey = LookupKey> = LookupRowMap[K];

/* ─── Type guards ────────────────────────────────────────────────────── */

export function isLookupKey(value: string | undefined): value is LookupKey {
  return value !== undefined && (LOOKUP_KEYS as readonly string[]).includes(value);
}

/* ─── Service result envelopes ───────────────────────────────────────── */

export interface DeleteSuccess {
  deleted: true;
}
export interface DeleteBlocked {
  deleted: false;
  /** Arabic reason for the UI toast. */
  reason: string;
  /** How many rows in *other* lookups reference this row. */
  referenceCount: number;
}
export type DeleteResult = DeleteSuccess | DeleteBlocked;
