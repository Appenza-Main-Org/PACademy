/**
 * Public surface for the Lookup Management Module.
 *
 * Consumers read lookup data via typed hooks. The mapped type
 * `LookupRow<K>` ensures every consumer gets the right per-key row
 * shape without downcasting.
 */

export {
  LOOKUP_KEYS,
  LOOKUP_SECTIONS,
  LOOKUP_META,
  isLookupKey,
  type LookupKey,
  type LookupRow,
  type LookupRowBase,
  type LookupRowMap,
  type RelationshipRow,
  type RelationshipBranch,
  type RelationshipGender,
  type RelationshipDegreeTierRow,
  type TestRow,
  type TestKind,
  type TestResultRow,
  type TestResultOutcome,
  type TestResultTone,
  type CommitteeRow,
  type SpecializationRow,
  type FacultyRow,
  type ApplicantCategoryRow,
  type ApplicantCategoryGenderScope,
  type ApplicantCategoryType,
  type NationalityCountryRow,
  type GovernorateRow,
  type GovernorateRegion,
  type PoliceStationRow,
  type PoliceStationKind,
  type JobRow,
  type QualificationRow,
  type QualificationLevel,
  type QualificationTrack,
  type AnnouncementRow,
  type AnnouncementGender,
  type ApplicantDivisionRow,
  type SchoolCategoryRow,
  type NidMissingReasonRow,
  type UniversityRow,
  type SubmissionTypeRow,
  type MaritalStatusRow,
  type AcademicGradeRow,
  type AcademicDegreeRow,
  type ExamRoundRow,
  type GraduationYearRow,
  type DeleteResult,
} from './types';

export { ACADEMIC_DEGREES } from './mock/lookups.mock';

export { lookupsService } from './api/lookups.service';

export {
  lookupKeys,
  useLookup,
  useApplicantCategories,
  useCreateLookupRow,
  useUpdateLookupRow,
  useDeleteLookupRow,
} from './api/lookups.queries';

export { ApplicantCategoryDetailPage } from './pages/ApplicantCategoryDetailPage';

export {
  GRADING_MODES,
  GRADING_MODE_LABELS_AR,
  assertGradingMode,
  type GradingMode,
} from './lib/gradingModes';

export { readGradingMode } from './lib/submissionType';

export {
  readPercentageRange,
  type AcademicGradeRange,
} from './lib/academicGrade';
