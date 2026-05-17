/**
 * Lookup Management Module — seed data.
 *
 * Source order (per the prompt):
 *  1. RFP scope document — تطوير المنظومة المعلوماتية بأكاديمية الشرطة،
 *     الكراسة والمواصفات الفنية 28-2-26، شركة ترابط.
 *  2. Published Egypt Police Academy sources — academy.moi.gov.eg,
 *     Ministry of Interior data, Arabic Wikipedia (governorates, faculty
 *     list, qualifications), where the RFP only references.
 *  3. Existing seeded values in `frontend/src/shared/mock-data/dictionaries.ts`
 *     that are already wired into the applicant wizard, eligibility, and
 *     admission-rules pages — preserved verbatim so those flows don't
 *     break.
 *
 * Codes are unique within each lookup and follow the per-lookup prefix
 * documented in `types.ts (LOOKUP_META)`.
 */

import type {
  AcademicDegreeRow,
  AcademicGradeRow,
  AnnouncementRow,
  ApplicantCategoryRow,
  ApplicantDivisionRow,
  CommitteeRow,
  ExamRoundRow,
  FacultyRow,
  GovernorateRow,
  GraduationYearRow,
  JobRow,
  LookupKey,
  LookupRow,
  MaritalStatusRow,
  NationalityCountryRow,
  NidMissingReasonRow,
  PoliceStationRow,
  QualificationRow,
  RelationshipDegreeTierRow,
  RelationshipRow,
  SchoolCategoryRow,
  SpecializationRow,
  SubmissionTypeRow,
  TestResultRow,
  TestRow,
  UniversityRow,
} from '../types';

/* ─── Helpers ────────────────────────────────────────────────────────── */

const active = { isActive: true } as const;

/* ─── 1. relationships — 4-degree tree, gender-marked ────────────────── */

const relationships: RelationshipRow[] = [
  // Degree 1
  { code: 'REL-001', name: 'أب',            isActive: true, parentCode: null,      branch: 'paternal', gender: 'male',   degree: 1 },
  { code: 'REL-002', name: 'أم',            isActive: true, parentCode: null,      branch: 'maternal', gender: 'female', degree: 1 },
  { code: 'REL-003', name: 'أخ',            isActive: true, parentCode: null,      branch: 'self',     gender: 'male',   degree: 1 },
  { code: 'REL-004', name: 'أخت',           isActive: true, parentCode: null,      branch: 'self',     gender: 'female', degree: 1 },
  { code: 'REL-005', name: 'زوج',           isActive: true, parentCode: null,      branch: 'spouse',   gender: 'male',   degree: 1 },
  { code: 'REL-006', name: 'زوجة',          isActive: true, parentCode: null,      branch: 'spouse',   gender: 'female', degree: 1 },
  // Degree 2 — paternal grandparents (children of أب)
  { code: 'REL-007', name: 'جد لأب',        isActive: true, parentCode: 'REL-001', branch: 'paternal', gender: 'male',   degree: 2 },
  { code: 'REL-008', name: 'جدة لأب',       isActive: true, parentCode: 'REL-001', branch: 'paternal', gender: 'female', degree: 2 },
  // Degree 2 — maternal grandparents (children of أم)
  { code: 'REL-009', name: 'جد لأم',        isActive: true, parentCode: 'REL-002', branch: 'maternal', gender: 'male',   degree: 2 },
  { code: 'REL-010', name: 'جدة لأم',       isActive: true, parentCode: 'REL-002', branch: 'maternal', gender: 'female', degree: 2 },
  // Degree 2 — uncles/aunts (siblings of parents → children of grandparents in tree)
  { code: 'REL-011', name: 'عم',            isActive: true, parentCode: 'REL-007', branch: 'paternal', gender: 'male',   degree: 2 },
  { code: 'REL-012', name: 'عمة',           isActive: true, parentCode: 'REL-007', branch: 'paternal', gender: 'female', degree: 2 },
  { code: 'REL-013', name: 'خال',           isActive: true, parentCode: 'REL-009', branch: 'maternal', gender: 'male',   degree: 2 },
  { code: 'REL-014', name: 'خالة',          isActive: true, parentCode: 'REL-009', branch: 'maternal', gender: 'female', degree: 2 },
  // Degree 2 — nieces/nephews via brother/sister
  { code: 'REL-015', name: 'ابن الأخ',      isActive: true, parentCode: 'REL-003', branch: 'self',     gender: 'male',   degree: 2 },
  { code: 'REL-016', name: 'بنت الأخ',      isActive: true, parentCode: 'REL-003', branch: 'self',     gender: 'female', degree: 2 },
  { code: 'REL-017', name: 'ابن الأخت',     isActive: true, parentCode: 'REL-004', branch: 'self',     gender: 'male',   degree: 2 },
  { code: 'REL-018', name: 'بنت الأخت',     isActive: true, parentCode: 'REL-004', branch: 'self',     gender: 'female', degree: 2 },
  // Degree 3 — cousins
  { code: 'REL-019', name: 'ابن العم',      isActive: true, parentCode: 'REL-011', branch: 'paternal', gender: 'male',   degree: 3 },
  { code: 'REL-020', name: 'بنت العم',      isActive: true, parentCode: 'REL-011', branch: 'paternal', gender: 'female', degree: 3 },
  { code: 'REL-021', name: 'ابن العمة',     isActive: true, parentCode: 'REL-012', branch: 'paternal', gender: 'male',   degree: 3 },
  { code: 'REL-022', name: 'بنت العمة',     isActive: true, parentCode: 'REL-012', branch: 'paternal', gender: 'female', degree: 3 },
  { code: 'REL-023', name: 'ابن الخال',     isActive: true, parentCode: 'REL-013', branch: 'maternal', gender: 'male',   degree: 3 },
  { code: 'REL-024', name: 'بنت الخال',     isActive: true, parentCode: 'REL-013', branch: 'maternal', gender: 'female', degree: 3 },
  { code: 'REL-025', name: 'ابن الخالة',    isActive: true, parentCode: 'REL-014', branch: 'maternal', gender: 'male',   degree: 3 },
  { code: 'REL-026', name: 'بنت الخالة',    isActive: true, parentCode: 'REL-014', branch: 'maternal', gender: 'female', degree: 3 },
  // Degree 3 — great-grandparents
  { code: 'REL-027', name: 'جد الأب',       isActive: true, parentCode: 'REL-007', branch: 'paternal', gender: 'male',   degree: 3 },
  { code: 'REL-028', name: 'جدة الأب',      isActive: true, parentCode: 'REL-008', branch: 'paternal', gender: 'female', degree: 3 },
  { code: 'REL-029', name: 'جد الأم',       isActive: true, parentCode: 'REL-009', branch: 'maternal', gender: 'male',   degree: 3 },
  { code: 'REL-030', name: 'جدة الأم',      isActive: true, parentCode: 'REL-010', branch: 'maternal', gender: 'female', degree: 3 },
  // Degree 4 — great-great-grandparents
  { code: 'REL-031', name: 'أبو جد الأب',   isActive: true, parentCode: 'REL-027', branch: 'paternal', gender: 'male',   degree: 4 },
  { code: 'REL-032', name: 'أم جد الأب',    isActive: true, parentCode: 'REL-027', branch: 'paternal', gender: 'female', degree: 4 },
  { code: 'REL-033', name: 'أبو جد الأم',   isActive: true, parentCode: 'REL-029', branch: 'maternal', gender: 'male',   degree: 4 },
  { code: 'REL-034', name: 'أم جد الأم',    isActive: true, parentCode: 'REL-029', branch: 'maternal', gender: 'female', degree: 4 },
];

/* ─── 2. relationship-degree-tiers ───────────────────────────────────── */

const relationshipDegreeTiers: RelationshipDegreeTierRow[] = [
  { code: 'RDT-1', name: 'الدرجة الأولى', isActive: true, degreeRange: 'الأقارب من الدرجة الأولى', maxDegree: 1 },
  { code: 'RDT-2', name: 'الدرجة الثانية', isActive: true, degreeRange: 'حتى الدرجة الثانية',     maxDegree: 2 },
  { code: 'RDT-3', name: 'الدرجة الثالثة', isActive: true, degreeRange: 'حتى الدرجة الثالثة',     maxDegree: 3 },
  { code: 'RDT-4', name: 'الدرجة الرابعة', isActive: true, degreeRange: 'حتى الدرجة الرابعة',     maxDegree: 4 },
];

/* ─── 3. tests — admission pipeline tests ────────────────────────────── */

const tests: TestRow[] = [
  { code: 'TST-01', name: 'القدرات',               isActive: true, kind: 'written',   order: 1,  required: true },
  { code: 'TST-02', name: 'المعلومات العامة',       isActive: true, kind: 'written',   order: 2,  required: true },
  { code: 'TST-03', name: 'الطول',                 isActive: true, kind: 'medical',   order: 3,  required: true },
  { code: 'TST-04', name: 'السمات الخارجية',        isActive: true, kind: 'interview', order: 4,  required: true },
  { code: 'TST-05', name: 'السمات الداخلية',        isActive: true, kind: 'interview', order: 5,  required: true },
  { code: 'TST-06', name: 'اللياقة الرياضية',       isActive: true, kind: 'physical',  order: 6,  required: true },
  { code: 'TST-07', name: 'إعادة الرياضي',          isActive: true, kind: 'physical',  order: 7,  required: false },
  { code: 'TST-08', name: 'الهيئة',                isActive: true, kind: 'interview', order: 8,  required: true },
  { code: 'TST-09', name: 'القوام',                isActive: true, kind: 'medical',   order: 9,  required: true },
  { code: 'TST-10', name: 'إعادة القوام',           isActive: true, kind: 'medical',   order: 10, required: false },
  { code: 'TST-11', name: 'الكشف الطبي',           isActive: true, kind: 'medical',   order: 11, required: true },
  { code: 'TST-12', name: 'إعادة الطبي',           isActive: true, kind: 'medical',   order: 12, required: false },
  { code: 'TST-13', name: 'الاتزان النفسي',         isActive: true, kind: 'psych',     order: 13, required: true },
  { code: 'TST-14', name: 'الكشف الطبي المتقدم',    isActive: true, kind: 'medical',   order: 14, required: true },
  { code: 'TST-15', name: 'المقابلة الشخصية',       isActive: true, kind: 'interview', order: 15, required: true },
];

/* ─── 4. test-results ────────────────────────────────────────────────── */

const testResults: TestResultRow[] = [
  { code: 'RES-01', name: 'ناجح',  isActive: true, outcome: 'pass',      tone: 'success' },
  { code: 'RES-02', name: 'راسب',  isActive: true, outcome: 'fail',      tone: 'danger'  },
  { code: 'RES-03', name: 'مؤجل',  isActive: true, outcome: 'defer',     tone: 'warning' },
  { code: 'RES-04', name: 'منسحب', isActive: true, outcome: 'withdrawn', tone: 'neutral' },
];

/* ─── 5. committees — admission committees ───────────────────────────── */

const committees: CommitteeRow[] = [
  { code: 'CMT-01', name: 'اللجنة الأولى قسم خاص (طالبات)',  isActive: true, applicantCategoryId: 'specialized_officers' },
  { code: 'CMT-02', name: 'اللجنة الثانية قسم خاص (طالبات)', isActive: true, applicantCategoryId: 'specialized_officers' },
  { code: 'CMT-03', name: 'اللجنة الثالثة قسم خاص (طالبات)', isActive: true, applicantCategoryId: 'specialized_officers' },
  { code: 'CMT-04', name: 'اللجنة الرابعة قسم خاص (طالبات)', isActive: true, applicantCategoryId: 'specialized_officers' },
  { code: 'CMT-05', name: 'اللجنة الخامسة قسم خاص',          isActive: true, applicantCategoryId: 'specialized_officers' },
  { code: 'CMT-06', name: 'اللجنة السادسة قسم خاص',          isActive: true, applicantCategoryId: 'specialized_officers' },
  { code: 'CMT-07', name: 'اللجنة السابعة قسم خاص',          isActive: true, applicantCategoryId: 'specialized_officers' },
  { code: 'CMT-08', name: 'اللجنة الثامنة قسم خاص',          isActive: true, applicantCategoryId: 'specialized_officers' },
  { code: 'CMT-09', name: 'اللجنة الأولى بكالوريوس تربية رياضية (طالبات)', isActive: true, applicantCategoryId: 'physical_education_bachelor' },
  { code: 'CMT-10', name: 'اللجنة الأولى ليسانس حقوق (طالبات)', isActive: true, applicantCategoryId: 'law_bachelor' },
  { code: 'CMT-11', name: 'اللجنة الثانية ليسانس حقوق',        isActive: true, applicantCategoryId: 'law_bachelor' },
  { code: 'CMT-12', name: 'اللجنة الأولى قسم عام',   isActive: true, applicantCategoryId: 'officers_general' },
  { code: 'CMT-13', name: 'اللجنة الثانية قسم عام',  isActive: true, applicantCategoryId: 'officers_general' },
  { code: 'CMT-14', name: 'اللجنة الثالثة قسم عام',  isActive: true, applicantCategoryId: 'officers_general' },
  { code: 'CMT-15', name: 'اللجنة الرابعة قسم عام',  isActive: true, applicantCategoryId: 'officers_general' },
  { code: 'CMT-16', name: 'اللجنة الخامسة قسم عام',  isActive: true, applicantCategoryId: 'officers_general' },
  { code: 'CMT-17', name: 'اللجنة السادسة قسم عام',  isActive: true, applicantCategoryId: 'officers_general' },
  { code: 'CMT-18', name: 'اللجنة السابعة قسم عام',  isActive: true, applicantCategoryId: 'officers_general' },
  { code: 'CMT-19', name: 'اللجنة الثامنة قسم عام',  isActive: true, applicantCategoryId: 'officers_general' },
];

/* ─── 6. faculties — Egyptian university faculties ─────────────────────
 *
 * Source: standard Egyptian university faculty roster (academy.moi.gov.eg
 * + Supreme Council of Universities + Wikipedia Arabic). Police Academy
 * faculties are out of scope here — applicants come from across Egyptian
 * universities, so this lookup mirrors that broader set. */

const faculties: FacultyRow[] = [
  { code: 'FAC-01', name: 'الطب البشري',              ...active },
  { code: 'FAC-02', name: 'الصيدلة الإكلينيكية',       ...active },
  { code: 'FAC-03', name: 'الطب البيطري',             ...active },
  { code: 'FAC-04', name: 'التمريض',                 ...active },
  { code: 'FAC-05', name: 'الهندسة',                 ...active },
  { code: 'FAC-06', name: 'الحاسبات والمعلومات',       ...active },
  { code: 'FAC-07', name: 'التجارة',                 ...active },
  { code: 'FAC-08', name: 'الزراعة',                 ...active },
  { code: 'FAC-09', name: 'التربية الموسيقية',         ...active },
  { code: 'FAC-10', name: 'الفنون التطبيقية',          ...active },
  { code: 'FAC-11', name: 'الفنون الجميلة',            ...active },
  { code: 'FAC-12', name: 'العلوم',                  ...active },
  { code: 'FAC-13', name: 'الاقتصاد والعلوم السياسية', ...active },
  { code: 'FAC-14', name: 'الآداب',                  ...active },
  { code: 'FAC-15', name: 'التربية',                 ...active },
  { code: 'FAC-16', name: 'اللغات',                  ...active },
  { code: 'FAC-17', name: 'الحقوق',                  ...active },
  { code: 'FAC-18', name: 'التربية الرياضية',          ...active },
];

/* ─── 7. specializations — Egyptian university specializations ─────────
 *
 * Each specialization carries `facultyCode` directly (FK → faculties).
 * Per-faculty programs surfaced for the admission categories that draw
 * graduates from each discipline. */

const specializations: SpecializationRow[] = [
  /* FAC-01 — الطب البشري */
  { code: 'SPC-01', name: 'جراحة عامة',              isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-02', name: 'جراحة مخ وأعصاب',         isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-03', name: 'قلب وصدر',               isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-04', name: 'مسالك بولية',             isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-05', name: 'قلب وأوعية دموية',         isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-06', name: 'عظام',                  isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-07', name: 'أورام',                  isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-08', name: 'تجميل',                  isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-09', name: 'وجه وفكين',              isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-10', name: 'باطنة',                  isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-11', name: 'جهاز هضمي ومناظير',        isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-12', name: 'صدرية',                  isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-13', name: 'رعايات مركزة',            isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-14', name: 'أمراض نساء',              isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-15', name: 'أنف وأذن',               isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-16', name: 'أمراض كلى',               isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-17', name: 'تخدير',                  isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-18', name: 'رمد',                    isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-19', name: 'طوارئ',                  isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-20', name: 'تحاليل طبية',             isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-21', name: 'أشعة',                   isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-22', name: 'أمراض دم',               isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-23', name: 'سمعيات',                 isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-24', name: 'تخاطب',                  isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-25', name: 'باثولوجي',                isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-26', name: 'غدد صماء وروماتيزم',       isActive: true, facultyCode: 'FAC-01' },

  /* FAC-02 — الصيدلة الإكلينيكية */
  { code: 'SPC-27', name: 'صيدلة إكلينيكية',          isActive: true, facultyCode: 'FAC-02' },

  /* FAC-03 — الطب البيطري */
  { code: 'SPC-28', name: 'طب بيطري',                isActive: true, facultyCode: 'FAC-03' },

  /* FAC-04 — التمريض */
  { code: 'SPC-29', name: 'تمريض',                  isActive: true, facultyCode: 'FAC-04' },

  /* FAC-05 — الهندسة */
  { code: 'SPC-30', name: 'حاسبات',                  isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-31', name: 'اتصالات وإلكترونيات',       isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-32', name: 'ميكانيكا سيارات',          isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-33', name: 'ميكانيكا قوى',             isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-34', name: 'ميكانيكا إنتاج',           isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-35', name: 'ميكاترونيكس',             isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-36', name: 'كهرباء قوى',              isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-37', name: 'مدني',                   isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-38', name: 'هندسة طبية',              isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-39', name: 'هندسة طرق',              isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-40', name: 'بحرية',                  isActive: true, facultyCode: 'FAC-05' },
  { code: 'SPC-41', name: 'عمارة',                  isActive: true, facultyCode: 'FAC-05' },

  /* FAC-06 — الحاسبات والمعلومات */
  { code: 'SPC-42', name: 'حاسبات',                  isActive: true, facultyCode: 'FAC-06' },

  /* FAC-07 — التجارة */
  { code: 'SPC-43', name: 'محاسبة',                  isActive: true, facultyCode: 'FAC-07' },

  /* FAC-08 — الزراعة */
  { code: 'SPC-44', name: 'هندسة زراعية',             isActive: true, facultyCode: 'FAC-08' },
  { code: 'SPC-45', name: 'نباتات زينة',              isActive: true, facultyCode: 'FAC-08' },

  /* FAC-09 — التربية الموسيقية */
  { code: 'SPC-46', name: 'تربية موسيقية',            isActive: true, facultyCode: 'FAC-09' },

  /* FAC-10 — الفنون التطبيقية */
  { code: 'SPC-47', name: 'جرافيك',                  isActive: true, facultyCode: 'FAC-10' },
  { code: 'SPC-48', name: 'أثاث وتصميم داخلي',         isActive: true, facultyCode: 'FAC-10' },

  /* FAC-11 — الفنون الجميلة */
  { code: 'SPC-49', name: 'جرافيك',                  isActive: true, facultyCode: 'FAC-11' },
  { code: 'SPC-50', name: 'أثاث وتصميم داخلي',         isActive: true, facultyCode: 'FAC-11' },

  /* FAC-12 — العلوم */
  { code: 'SPC-51', name: 'كيمياء',                  isActive: true, facultyCode: 'FAC-12' },
  { code: 'SPC-52', name: 'ميكروبيولوجي',             isActive: true, facultyCode: 'FAC-12' },
  { code: 'SPC-53', name: 'فيزياء',                  isActive: true, facultyCode: 'FAC-12' },
  { code: 'SPC-54', name: 'تحاليل طبية',             isActive: true, facultyCode: 'FAC-12' },
  { code: 'SPC-55', name: 'علوم طبية',               isActive: true, facultyCode: 'FAC-12' },

  /* FAC-13 — الاقتصاد والعلوم السياسية */
  { code: 'SPC-56', name: 'إحصاء',                   isActive: true, facultyCode: 'FAC-13' },
  { code: 'SPC-57', name: 'علوم سياسية',             isActive: true, facultyCode: 'FAC-13' },

  /* FAC-14 — الآداب */
  { code: 'SPC-58', name: 'مكتبات',                  isActive: true, facultyCode: 'FAC-14' },
  { code: 'SPC-59', name: 'علم نفس',                 isActive: true, facultyCode: 'FAC-14' },

  /* FAC-15 — التربية */
  { code: 'SPC-60', name: 'علم نفس',                 isActive: true, facultyCode: 'FAC-15' },

  /* FAC-16 — اللغات */
  { code: 'SPC-61', name: 'إنجليزي',                 isActive: true, facultyCode: 'FAC-16' },
  { code: 'SPC-62', name: 'فرنسي',                   isActive: true, facultyCode: 'FAC-16' },
  { code: 'SPC-63', name: 'إسباني',                  isActive: true, facultyCode: 'FAC-16' },
  { code: 'SPC-64', name: 'ألماني',                  isActive: true, facultyCode: 'FAC-16' },
  { code: 'SPC-65', name: 'روسي',                    isActive: true, facultyCode: 'FAC-16' },
  { code: 'SPC-66', name: 'إيطالي',                  isActive: true, facultyCode: 'FAC-16' },
  { code: 'SPC-67', name: 'تركي',                    isActive: true, facultyCode: 'FAC-16' },
  { code: 'SPC-68', name: 'عبري',                    isActive: true, facultyCode: 'FAC-16' },
  { code: 'SPC-69', name: 'صيني',                    isActive: true, facultyCode: 'FAC-16' },

  /* FAC-17 — الحقوق */
  { code: 'SPC-70', name: 'حقوق',                    isActive: true, facultyCode: 'FAC-17' },

  /* FAC-18 — التربية الرياضية */
  { code: 'SPC-71', name: 'تربية رياضية',             isActive: true, facultyCode: 'FAC-18' },
];

/* ─── 8.5 submission-types ───────────────────────────────────────────── */

/* Discriminator for how the applicant-side reports academic results.
 * Each row's `metadata.gradingMode` flips the downstream branch — read via
 * `readGradingMode(row)` from `../lib/submissionType.ts`.
 *
 * Codes are SUB-001..SUB-NNN (3-digit, per the patched Step 1.4 spec).
 * `createdAt` / `createdBy` are stashed inside `metadata` because no other
 * row in the lookup module carries audit fields and adding them just here
 * would be inconsistent — surface them through `metadata` until the
 * audit columns land system-wide. */

const SUBMISSION_TYPE_CREATED_AT = '2026-05-12T00:00:00.000Z';

const submissionTypes: SubmissionTypeRow[] = [
  {
    code: 'SUB-001',
    name: 'تقديم عام',
    nameEn: 'General Submission',
    isActive: true,
    sortOrder: 1,
    metadata: { gradingMode: 'GRADES', createdBy: 'system', createdAt: SUBMISSION_TYPE_CREATED_AT },
  },
  {
    code: 'SUB-002',
    name: 'تقديم المتخصصين',
    nameEn: 'Specialists Submission',
    isActive: true,
    sortOrder: 2,
    metadata: { gradingMode: 'TAGDIR', createdBy: 'system', createdAt: SUBMISSION_TYPE_CREATED_AT },
  },
  {
    code: 'SUB-003',
    name: 'تقديم الحقوقيين',
    nameEn: 'Law Graduates Submission',
    isActive: true,
    sortOrder: 3,
    metadata: { gradingMode: 'TAGDIR', createdBy: 'system', createdAt: SUBMISSION_TYPE_CREATED_AT },
  },
  {
    code: 'SUB-004',
    name: 'تربية رياضية إناث',
    nameEn: 'Physical Education — Females',
    isActive: true,
    sortOrder: 4,
    /* RFP §2.1 — physical-education-bachelor uses تقدير (TAGDIR), not a
     * numeric percentage. Flipped 2026-05-12 alongside the
     * applicant-categories lockdown to the 4 RFP-defined categories. */
    metadata: { gradingMode: 'TAGDIR', createdBy: 'system', createdAt: SUBMISSION_TYPE_CREATED_AT },
  },
];

/* ─── 9. applicant-categories — RFP §2.1 (4 categories, closed set) ────
 *
 * Authoritative source: the RFP Scope Document. The four categories are
 * the only ones the platform offers; no admin-defined custom categories
 * are permitted. Codes stay snake_case to match the rest of the codebase
 * (kebab in the brief table is presentational only).
 *
 *   officers_general              — قسم الضباط (قسم عام)
 *   law_bachelor                  — ليسانس حقوق
 *   physical_education_bachelor   — بكالوريوس تربية رياضية
 *   specialized_officers          — الضباط المتخصصون (renamed from
 *                                   `officers_specialized`)
 *
 * `metadata.submissionTypeCode` FKs into `submission-types` and decides
 * the downstream gradingMode branch:
 *   officers_general            → SUB-001 (GRADES — numeric %)
 *   law_bachelor                → SUB-003 (TAGDIR — تقدير)
 *   physical_education_bachelor → SUB-004 (TAGDIR — تقدير)
 *   specialized_officers        → SUB-002 (TAGDIR — تقدير)
 *
 * The five legacy categories that were retired (postgraduate,
 * institute_officers_training, institute_traffic, institute_guarding,
 * special_units) are documented in
 * docs/migration/admission-categories-rfp/AUDIT.md. */

const CATEGORY_SUBMISSION_MAP: Record<string, string> = {
  officers_general:            'SUB-001',
  specialized_officers:        'SUB-002',
  law_bachelor:                'SUB-003',
  physical_education_bachelor: 'SUB-004',
};

function submissionTypeCodeFor(categoryCode: string): string {
  const code = CATEGORY_SUBMISSION_MAP[categoryCode];
  if (!code) throw new Error(`No submission-type mapping for category ${categoryCode}`);
  return code;
}

const applicantCategories: ApplicantCategoryRow[] = [
  {
    code: 'officers_general',
    name: 'قسم الضباط (قسم عام)',
    isActive: true,
    metadata: { submissionTypeCode: submissionTypeCodeFor('officers_general') },
    nameEn: 'General Officers Department',
    description: 'الالتحاق بكلية الشرطة عبر القسم العام لخريجي الثانوية العامة',
    isOpen: true,
    genderScope: ['male'],
    type: 'pre_university',
    facultyCodes: [],
    specializationCodes: [],
    conditions: {
      ageMin: null, ageMax: null, minScorePercent: null,
      requiredQualification: 'thanaweya_amma', gender: 'male',
      minHeightCm: 170, medicalRequired: true, maritalStatus: 'single',
      conductCheck: true, egyptianNationalityRequired: true,
      employerApprovalRequired: false, nominationOnly: false,
      freeText: ['مجموع مناسب في الثانوية العامة'],
    },
    requiredTests: [
      { kind: 'aptitude',      order: 1, passingCriteria: '' },
      { kind: 'posture',       order: 2, passingCriteria: '' },
      { kind: 'medical',       order: 3, passingCriteria: '' },
      { kind: 'physical',      order: 4, passingCriteria: '' },
      { kind: 'psychological', order: 5, passingCriteria: '' },
      { kind: 'interview',     order: 6, passingCriteria: '' },
      { kind: 'drug',          order: 7, passingCriteria: '' },
    ],
    procedures: [],
  },
  {
    code: 'law_bachelor',
    name: 'ليسانس حقوق',
    isActive: true,
    metadata: { submissionTypeCode: submissionTypeCodeFor('law_bachelor') },
    nameEn: 'Bachelor of Law',
    description: 'الالتحاق لخريجي كليات الحقوق',
    isOpen: true,
    genderScope: ['male', 'female'],
    type: 'university',
    facultyCodes: ['FAC-17'],
    specializationCodes: [],
    conditions: {
      ageMin: null, ageMax: null, minScorePercent: null,
      requiredQualification: 'bachelor_law', gender: 'any',
      minHeightCm: null, medicalRequired: true, maritalStatus: 'any',
      conductCheck: true, egyptianNationalityRequired: true,
      employerApprovalRequired: false, nominationOnly: false,
      freeText: ['ليسانس حقوق', 'تقدير مناسب', 'حسن السمعة'],
    },
    requiredTests: [
      { kind: 'posture',       order: 1, passingCriteria: '' },
      { kind: 'medical',       order: 2, passingCriteria: '' },
      { kind: 'physical',      order: 3, passingCriteria: '' },
      { kind: 'psychological', order: 4, passingCriteria: '' },
      { kind: 'interview',     order: 5, passingCriteria: '' },
      { kind: 'drug',          order: 6, passingCriteria: '' },
    ],
    procedures: [],
  },
  {
    code: 'physical_education_bachelor',
    name: 'بكالوريوس تربية رياضية',
    isActive: true,
    metadata: { submissionTypeCode: submissionTypeCodeFor('physical_education_bachelor') },
    nameEn: 'Bachelor of Physical Education',
    description: 'الالتحاق لخريجات كليات التربية الرياضية',
    isOpen: true,
    genderScope: ['female'],
    type: 'university',
    facultyCodes: ['FAC-18'],
    specializationCodes: [],
    conditions: {
      ageMin: null, ageMax: null, minScorePercent: null,
      requiredQualification: 'bachelor', gender: 'female',
      minHeightCm: null, medicalRequired: true, maritalStatus: 'any',
      conductCheck: true, egyptianNationalityRequired: true,
      employerApprovalRequired: false, nominationOnly: false,
      freeText: ['بكالوريوس تربية رياضية', 'تقدير مناسب', 'حسن السمعة'],
    },
    requiredTests: [
      { kind: 'posture',       order: 1, passingCriteria: '' },
      { kind: 'medical',       order: 2, passingCriteria: '' },
      { kind: 'physical',      order: 3, passingCriteria: '' },
      { kind: 'psychological', order: 4, passingCriteria: '' },
      { kind: 'interview',     order: 5, passingCriteria: '' },
      { kind: 'drug',          order: 6, passingCriteria: '' },
    ],
    procedures: [],
  },
  {
    code: 'specialized_officers',
    name: 'الضباط المتخصصون',
    isActive: true,
    metadata: { submissionTypeCode: submissionTypeCodeFor('specialized_officers') },
    nameEn: 'Specialized Officers',
    description: 'الالتحاق لخريجي الجامعات في تخصصات الطب والهندسة والإعلام وغيرها',
    isOpen: true,
    genderScope: ['male', 'female'],
    type: 'university',
    /* All faculties listed under /admin/lookups/faculties except the
     * single-discipline ones already claimed by other categories
     * (FAC-17 الحقوق, FAC-18 التربية الرياضية). */
    facultyCodes: [
      'FAC-01', 'FAC-02', 'FAC-03', 'FAC-04', 'FAC-05',
      'FAC-06', 'FAC-07', 'FAC-08', 'FAC-09', 'FAC-10',
      'FAC-11', 'FAC-12', 'FAC-13', 'FAC-14', 'FAC-15',
      'FAC-16',
    ],
    specializationCodes: [],
    conditions: {
      ageMin: null, ageMax: 28, minScorePercent: null,
      requiredQualification: 'bachelor', gender: 'any',
      minHeightCm: null, medicalRequired: true, maritalStatus: 'any',
      conductCheck: true, egyptianNationalityRequired: false,
      employerApprovalRequired: false, nominationOnly: false,
      freeText: [
        'مؤهل عالي (طب / هندسة / إعلام / …)',
        'تقدير مناسب (جيد على الأقل)',
        'حسن السمعة',
      ],
    },
    requiredTests: [
      { kind: 'posture',       order: 1, passingCriteria: '' },
      { kind: 'medical',       order: 2, passingCriteria: '' },
      { kind: 'physical',      order: 3, passingCriteria: '' },
      { kind: 'psychological', order: 4, passingCriteria: '' },
      { kind: 'interview',     order: 5, passingCriteria: '' },
      { kind: 'drug',          order: 6, passingCriteria: '' },
    ],
    procedures: [],
  },
];

/* ─── 10. nationalities-countries — Arab League + 30 common others ──── */

const nationalitiesCountries: NationalityCountryRow[] = [
  // Arab League (22)
  { code: 'CNT-001', name: 'مصر',          isActive: true, iso2: 'EG', isArab: true },
  { code: 'CNT-002', name: 'السعودية',      isActive: true, iso2: 'SA', isArab: true },
  { code: 'CNT-003', name: 'الإمارات',      isActive: true, iso2: 'AE', isArab: true },
  { code: 'CNT-004', name: 'الكويت',        isActive: true, iso2: 'KW', isArab: true },
  { code: 'CNT-005', name: 'قطر',           isActive: true, iso2: 'QA', isArab: true },
  { code: 'CNT-006', name: 'البحرين',       isActive: true, iso2: 'BH', isArab: true },
  { code: 'CNT-007', name: 'عُمان',         isActive: true, iso2: 'OM', isArab: true },
  { code: 'CNT-008', name: 'الأردن',        isActive: true, iso2: 'JO', isArab: true },
  { code: 'CNT-009', name: 'فلسطين',        isActive: true, iso2: 'PS', isArab: true },
  { code: 'CNT-010', name: 'سوريا',         isActive: true, iso2: 'SY', isArab: true },
  { code: 'CNT-011', name: 'لبنان',         isActive: true, iso2: 'LB', isArab: true },
  { code: 'CNT-012', name: 'العراق',        isActive: true, iso2: 'IQ', isArab: true },
  { code: 'CNT-013', name: 'ليبيا',          isActive: true, iso2: 'LY', isArab: true },
  { code: 'CNT-014', name: 'السودان',       isActive: true, iso2: 'SD', isArab: true },
  { code: 'CNT-015', name: 'اليمن',         isActive: true, iso2: 'YE', isArab: true },
  { code: 'CNT-016', name: 'المغرب',        isActive: true, iso2: 'MA', isArab: true },
  { code: 'CNT-017', name: 'الجزائر',       isActive: true, iso2: 'DZ', isArab: true },
  { code: 'CNT-018', name: 'تونس',          isActive: true, iso2: 'TN', isArab: true },
  { code: 'CNT-019', name: 'موريتانيا',     isActive: true, iso2: 'MR', isArab: true },
  { code: 'CNT-020', name: 'الصومال',       isActive: true, iso2: 'SO', isArab: true },
  { code: 'CNT-021', name: 'جيبوتي',         isActive: true, iso2: 'DJ', isArab: true },
  { code: 'CNT-022', name: 'جزر القمر',     isActive: true, iso2: 'KM', isArab: true },
  // Common non-Arab nationalities for family-tree purposes (alphabetical Arabic)
  { code: 'CNT-023', name: 'الولايات المتحدة', isActive: true, iso2: 'US', isArab: false },
  { code: 'CNT-024', name: 'كندا',          isActive: true, iso2: 'CA', isArab: false },
  { code: 'CNT-025', name: 'المملكة المتحدة', isActive: true, iso2: 'GB', isArab: false },
  { code: 'CNT-026', name: 'فرنسا',         isActive: true, iso2: 'FR', isArab: false },
  { code: 'CNT-027', name: 'ألمانيا',        isActive: true, iso2: 'DE', isArab: false },
  { code: 'CNT-028', name: 'إيطاليا',        isActive: true, iso2: 'IT', isArab: false },
  { code: 'CNT-029', name: 'إسبانيا',        isActive: true, iso2: 'ES', isArab: false },
  { code: 'CNT-030', name: 'البرتغال',       isActive: true, iso2: 'PT', isArab: false },
  { code: 'CNT-031', name: 'هولندا',         isActive: true, iso2: 'NL', isArab: false },
  { code: 'CNT-032', name: 'بلجيكا',         isActive: true, iso2: 'BE', isArab: false },
  { code: 'CNT-033', name: 'سويسرا',         isActive: true, iso2: 'CH', isArab: false },
  { code: 'CNT-034', name: 'النمسا',         isActive: true, iso2: 'AT', isArab: false },
  { code: 'CNT-035', name: 'السويد',         isActive: true, iso2: 'SE', isArab: false },
  { code: 'CNT-036', name: 'الدنمارك',       isActive: true, iso2: 'DK', isArab: false },
  { code: 'CNT-037', name: 'النرويج',        isActive: true, iso2: 'NO', isArab: false },
  { code: 'CNT-038', name: 'فنلندا',         isActive: true, iso2: 'FI', isArab: false },
  { code: 'CNT-039', name: 'بولندا',         isActive: true, iso2: 'PL', isArab: false },
  { code: 'CNT-040', name: 'روسيا',          isActive: true, iso2: 'RU', isArab: false },
  { code: 'CNT-041', name: 'أوكرانيا',       isActive: true, iso2: 'UA', isArab: false },
  { code: 'CNT-042', name: 'تركيا',          isActive: true, iso2: 'TR', isArab: false },
  { code: 'CNT-043', name: 'إيران',          isActive: true, iso2: 'IR', isArab: false },
  { code: 'CNT-044', name: 'باكستان',         isActive: true, iso2: 'PK', isArab: false },
  { code: 'CNT-045', name: 'الهند',          isActive: true, iso2: 'IN', isArab: false },
  { code: 'CNT-046', name: 'بنغلاديش',       isActive: true, iso2: 'BD', isArab: false },
  { code: 'CNT-047', name: 'إندونيسيا',       isActive: true, iso2: 'ID', isArab: false },
  { code: 'CNT-048', name: 'ماليزيا',         isActive: true, iso2: 'MY', isArab: false },
  { code: 'CNT-049', name: 'الصين',          isActive: true, iso2: 'CN', isArab: false },
  { code: 'CNT-050', name: 'اليابان',         isActive: true, iso2: 'JP', isArab: false },
  { code: 'CNT-051', name: 'كوريا الجنوبية',  isActive: true, iso2: 'KR', isArab: false },
  { code: 'CNT-052', name: 'أستراليا',        isActive: true, iso2: 'AU', isArab: false },
  { code: 'CNT-053', name: 'نيجيريا',         isActive: true, iso2: 'NG', isArab: false },
  { code: 'CNT-054', name: 'إثيوبيا',         isActive: true, iso2: 'ET', isArab: false },
  { code: 'CNT-055', name: 'كينيا',           isActive: true, iso2: 'KE', isArab: false },
  { code: 'CNT-056', name: 'جنوب أفريقيا',    isActive: true, iso2: 'ZA', isArab: false },
];

/* ─── 11. governorates — all 27 with region split ────────────────────── */

const governorates: GovernorateRow[] = [
  // Greater Cairo
  { code: 'GOV-01', name: 'القاهرة',        isActive: true, region: 'القاهرة الكبرى' },
  { code: 'GOV-02', name: 'الجيزة',         isActive: true, region: 'القاهرة الكبرى' },
  { code: 'GOV-03', name: 'القليوبية',      isActive: true, region: 'القاهرة الكبرى' },
  // Lower Egypt (Delta)
  { code: 'GOV-04', name: 'الإسكندرية',     isActive: true, region: 'الوجه البحري' },
  { code: 'GOV-05', name: 'الدقهلية',       isActive: true, region: 'الوجه البحري' },
  { code: 'GOV-06', name: 'الشرقية',        isActive: true, region: 'الوجه البحري' },
  { code: 'GOV-07', name: 'المنوفية',       isActive: true, region: 'الوجه البحري' },
  { code: 'GOV-08', name: 'البحيرة',        isActive: true, region: 'الوجه البحري' },
  { code: 'GOV-09', name: 'الغربية',        isActive: true, region: 'الوجه البحري' },
  { code: 'GOV-10', name: 'كفر الشيخ',      isActive: true, region: 'الوجه البحري' },
  { code: 'GOV-11', name: 'دمياط',          isActive: true, region: 'الوجه البحري' },
  // Upper Egypt
  { code: 'GOV-12', name: 'بني سويف',       isActive: true, region: 'الوجه القبلي' },
  { code: 'GOV-13', name: 'الفيوم',         isActive: true, region: 'الوجه القبلي' },
  { code: 'GOV-14', name: 'المنيا',         isActive: true, region: 'الوجه القبلي' },
  { code: 'GOV-15', name: 'أسيوط',          isActive: true, region: 'الوجه القبلي' },
  { code: 'GOV-16', name: 'سوهاج',          isActive: true, region: 'الوجه القبلي' },
  { code: 'GOV-17', name: 'قنا',             isActive: true, region: 'الوجه القبلي' },
  { code: 'GOV-18', name: 'الأقصر',          isActive: true, region: 'الوجه القبلي' },
  { code: 'GOV-19', name: 'أسوان',           isActive: true, region: 'الوجه القبلي' },
  // Canal
  { code: 'GOV-20', name: 'بورسعيد',         isActive: true, region: 'القناة' },
  { code: 'GOV-21', name: 'الإسماعيلية',     isActive: true, region: 'القناة' },
  { code: 'GOV-22', name: 'السويس',          isActive: true, region: 'القناة' },
  // Frontier
  { code: 'GOV-23', name: 'البحر الأحمر',    isActive: true, region: 'الحدود' },
  { code: 'GOV-24', name: 'الوادي الجديد',   isActive: true, region: 'الحدود' },
  { code: 'GOV-25', name: 'مرسى مطروح',      isActive: true, region: 'الحدود' },
  { code: 'GOV-26', name: 'شمال سيناء',      isActive: true, region: 'الحدود' },
  { code: 'GOV-27', name: 'جنوب سيناء',      isActive: true, region: 'الحدود' },
];

/* ─── 12. police-stations — 60+ representative seeds ─────────────────── */

const policeStations: PoliceStationRow[] = [
  // القاهرة (GOV-01)
  { code: 'PST-0001', name: 'قسم عابدين',         isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  { code: 'PST-0002', name: 'قسم السيدة زينب',    isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  { code: 'PST-0003', name: 'قسم مصر القديمة',     isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  { code: 'PST-0004', name: 'قسم النزهة',          isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  { code: 'PST-0005', name: 'قسم مدينة نصر أول',   isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  { code: 'PST-0006', name: 'قسم مصر الجديدة',     isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  { code: 'PST-0007', name: 'قسم المعادي',         isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  { code: 'PST-0008', name: 'قسم حلوان',           isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  { code: 'PST-0009', name: 'قسم شبرا',            isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  { code: 'PST-0010', name: 'قسم الزيتون',          isActive: true, governorateCode: 'GOV-01', kind: 'قسم' },
  // الجيزة (GOV-02)
  { code: 'PST-0011', name: 'قسم الدقي',           isActive: true, governorateCode: 'GOV-02', kind: 'قسم' },
  { code: 'PST-0012', name: 'قسم العجوزة',         isActive: true, governorateCode: 'GOV-02', kind: 'قسم' },
  { code: 'PST-0013', name: 'قسم العمرانية',       isActive: true, governorateCode: 'GOV-02', kind: 'قسم' },
  { code: 'PST-0014', name: 'قسم بولاق الدكرور',   isActive: true, governorateCode: 'GOV-02', kind: 'قسم' },
  { code: 'PST-0015', name: 'قسم الهرم',           isActive: true, governorateCode: 'GOV-02', kind: 'قسم' },
  { code: 'PST-0016', name: 'مركز إمبابة',          isActive: true, governorateCode: 'GOV-02', kind: 'مركز' },
  { code: 'PST-0017', name: 'مركز كرداسة',          isActive: true, governorateCode: 'GOV-02', kind: 'مركز' },
  { code: 'PST-0018', name: 'مركز أوسيم',           isActive: true, governorateCode: 'GOV-02', kind: 'مركز' },
  // القليوبية (GOV-03)
  { code: 'PST-0019', name: 'قسم بنها',            isActive: true, governorateCode: 'GOV-03', kind: 'قسم' },
  { code: 'PST-0020', name: 'قسم القناطر الخيرية',  isActive: true, governorateCode: 'GOV-03', kind: 'قسم' },
  { code: 'PST-0021', name: 'مركز شبرا الخيمة',     isActive: true, governorateCode: 'GOV-03', kind: 'مركز' },
  { code: 'PST-0022', name: 'مركز قها',             isActive: true, governorateCode: 'GOV-03', kind: 'مركز' },
  // الإسكندرية (GOV-04)
  { code: 'PST-0023', name: 'قسم محرم بك',         isActive: true, governorateCode: 'GOV-04', kind: 'قسم' },
  { code: 'PST-0024', name: 'قسم سيدي جابر',        isActive: true, governorateCode: 'GOV-04', kind: 'قسم' },
  { code: 'PST-0025', name: 'قسم الرمل',           isActive: true, governorateCode: 'GOV-04', kind: 'قسم' },
  { code: 'PST-0026', name: 'قسم المنتزة',         isActive: true, governorateCode: 'GOV-04', kind: 'قسم' },
  { code: 'PST-0027', name: 'قسم العامرية',         isActive: true, governorateCode: 'GOV-04', kind: 'قسم' },
  { code: 'PST-0028', name: 'قسم العطارين',         isActive: true, governorateCode: 'GOV-04', kind: 'قسم' },
  // الدقهلية (GOV-05)
  { code: 'PST-0029', name: 'قسم أول المنصورة',    isActive: true, governorateCode: 'GOV-05', kind: 'قسم' },
  { code: 'PST-0030', name: 'قسم ثاني المنصورة',   isActive: true, governorateCode: 'GOV-05', kind: 'قسم' },
  { code: 'PST-0031', name: 'مركز ميت غمر',         isActive: true, governorateCode: 'GOV-05', kind: 'مركز' },
  { code: 'PST-0032', name: 'مركز السنبلاوين',      isActive: true, governorateCode: 'GOV-05', kind: 'مركز' },
  // الشرقية (GOV-06)
  { code: 'PST-0033', name: 'قسم أول الزقازيق',    isActive: true, governorateCode: 'GOV-06', kind: 'قسم' },
  { code: 'PST-0034', name: 'قسم ثاني الزقازيق',   isActive: true, governorateCode: 'GOV-06', kind: 'قسم' },
  { code: 'PST-0035', name: 'مركز بلبيس',           isActive: true, governorateCode: 'GOV-06', kind: 'مركز' },
  { code: 'PST-0036', name: 'مركز فاقوس',           isActive: true, governorateCode: 'GOV-06', kind: 'مركز' },
  { code: 'PST-0037', name: 'مركز أبو حماد',        isActive: true, governorateCode: 'GOV-06', kind: 'مركز' },
  // المنوفية (GOV-07)
  { code: 'PST-0038', name: 'قسم شبين الكوم',       isActive: true, governorateCode: 'GOV-07', kind: 'قسم' },
  { code: 'PST-0039', name: 'مركز منوف',            isActive: true, governorateCode: 'GOV-07', kind: 'مركز' },
  { code: 'PST-0040', name: 'مركز قويسنا',          isActive: true, governorateCode: 'GOV-07', kind: 'مركز' },
  // البحيرة (GOV-08)
  { code: 'PST-0041', name: 'قسم دمنهور',           isActive: true, governorateCode: 'GOV-08', kind: 'قسم' },
  { code: 'PST-0042', name: 'مركز كفر الدوار',       isActive: true, governorateCode: 'GOV-08', kind: 'مركز' },
  { code: 'PST-0043', name: 'مركز إيتاي البارود',    isActive: true, governorateCode: 'GOV-08', kind: 'مركز' },
  // الغربية (GOV-09)
  { code: 'PST-0044', name: 'قسم أول طنطا',         isActive: true, governorateCode: 'GOV-09', kind: 'قسم' },
  { code: 'PST-0045', name: 'قسم ثاني طنطا',        isActive: true, governorateCode: 'GOV-09', kind: 'قسم' },
  { code: 'PST-0046', name: 'قسم المحلة الكبرى',    isActive: true, governorateCode: 'GOV-09', kind: 'قسم' },
  // كفر الشيخ (GOV-10)
  { code: 'PST-0047', name: 'قسم كفر الشيخ',         isActive: true, governorateCode: 'GOV-10', kind: 'قسم' },
  { code: 'PST-0048', name: 'مركز دسوق',             isActive: true, governorateCode: 'GOV-10', kind: 'مركز' },
  // دمياط (GOV-11)
  { code: 'PST-0049', name: 'قسم دمياط',             isActive: true, governorateCode: 'GOV-11', kind: 'قسم' },
  { code: 'PST-0050', name: 'بندر فارسكور',          isActive: true, governorateCode: 'GOV-11', kind: 'بندر' },
  // أسيوط (GOV-15)
  { code: 'PST-0051', name: 'قسم أول أسيوط',         isActive: true, governorateCode: 'GOV-15', kind: 'قسم' },
  { code: 'PST-0052', name: 'مركز ديروط',            isActive: true, governorateCode: 'GOV-15', kind: 'مركز' },
  { code: 'PST-0053', name: 'مركز منفلوط',           isActive: true, governorateCode: 'GOV-15', kind: 'مركز' },
  // سوهاج (GOV-16)
  { code: 'PST-0054', name: 'قسم سوهاج',             isActive: true, governorateCode: 'GOV-16', kind: 'قسم' },
  { code: 'PST-0055', name: 'مركز جرجا',             isActive: true, governorateCode: 'GOV-16', kind: 'مركز' },
  // قنا (GOV-17)
  { code: 'PST-0056', name: 'قسم قنا',               isActive: true, governorateCode: 'GOV-17', kind: 'قسم' },
  { code: 'PST-0057', name: 'مركز قوص',               isActive: true, governorateCode: 'GOV-17', kind: 'مركز' },
  // الأقصر (GOV-18)
  { code: 'PST-0058', name: 'قسم الأقصر',            isActive: true, governorateCode: 'GOV-18', kind: 'قسم' },
  // أسوان (GOV-19)
  { code: 'PST-0059', name: 'قسم أسوان',             isActive: true, governorateCode: 'GOV-19', kind: 'قسم' },
  { code: 'PST-0060', name: 'مركز كوم أمبو',          isActive: true, governorateCode: 'GOV-19', kind: 'مركز' },
  // بورسعيد (GOV-20)
  { code: 'PST-0061', name: 'قسم بورسعيد',           isActive: true, governorateCode: 'GOV-20', kind: 'قسم' },
  { code: 'PST-0062', name: 'قسم الشرق',             isActive: true, governorateCode: 'GOV-20', kind: 'قسم' },
  // الإسماعيلية (GOV-21)
  { code: 'PST-0063', name: 'قسم الإسماعيلية',       isActive: true, governorateCode: 'GOV-21', kind: 'قسم' },
  // السويس (GOV-22)
  { code: 'PST-0064', name: 'قسم السويس',            isActive: true, governorateCode: 'GOV-22', kind: 'قسم' },
];

/* ─── 13. jobs — categories (parentCode=null) + jobs ─────────────────── */

const jobs: JobRow[] = [
  // Categories
  { code: 'JOB-001', name: 'وظائف حكومية',   isActive: true, parentCode: null },
  { code: 'JOB-002', name: 'وظائف القطاع الخاص', isActive: true, parentCode: null },
  { code: 'JOB-003', name: 'مهن حرة',          isActive: true, parentCode: null },
  { code: 'JOB-004', name: 'الجهات العسكرية',   isActive: true, parentCode: null },
  // Government
  { code: 'JOB-101', name: 'مدرّس',            isActive: true, parentCode: 'JOB-001' },
  { code: 'JOB-102', name: 'موظف حكومي',      isActive: true, parentCode: 'JOB-001' },
  { code: 'JOB-103', name: 'طبيب حكومي',       isActive: true, parentCode: 'JOB-001' },
  { code: 'JOB-104', name: 'مهندس حكومي',      isActive: true, parentCode: 'JOB-001' },
  { code: 'JOB-105', name: 'محاسب حكومي',      isActive: true, parentCode: 'JOB-001' },
  { code: 'JOB-106', name: 'قاضٍ',             isActive: true, parentCode: 'JOB-001' },
  // Private sector
  { code: 'JOB-201', name: 'موظف قطاع خاص',    isActive: true, parentCode: 'JOB-002' },
  { code: 'JOB-202', name: 'رجل أعمال',         isActive: true, parentCode: 'JOB-002' },
  { code: 'JOB-203', name: 'مدير شركة',         isActive: true, parentCode: 'JOB-002' },
  // Free / liberal professions
  { code: 'JOB-301', name: 'طبيب',             isActive: true, parentCode: 'JOB-003' },
  { code: 'JOB-302', name: 'محامٍ',            isActive: true, parentCode: 'JOB-003' },
  { code: 'JOB-303', name: 'مهندس استشاري',     isActive: true, parentCode: 'JOB-003' },
  { code: 'JOB-304', name: 'صيدلي',             isActive: true, parentCode: 'JOB-003' },
  { code: 'JOB-305', name: 'محاسب قانوني',      isActive: true, parentCode: 'JOB-003' },
  // Military / armed forces
  { code: 'JOB-401', name: 'ضابط شرطة',         isActive: true, parentCode: 'JOB-004' },
  { code: 'JOB-402', name: 'ضابط قوات مسلحة',   isActive: true, parentCode: 'JOB-004' },
  { code: 'JOB-403', name: 'ضابط مخابرات',      isActive: true, parentCode: 'JOB-004' },
  { code: 'JOB-404', name: 'ضابط حرس حدود',     isActive: true, parentCode: 'JOB-004' },
  // Misc (other / homemaker / retired)
  { code: 'JOB-501', name: 'ربة منزل',          isActive: true, parentCode: null },
  { code: 'JOB-502', name: 'متقاعد',            isActive: true, parentCode: null },
  { code: 'JOB-503', name: 'لا يعمل',            isActive: true, parentCode: null },
];

/* ─── 14. qualifications ─────────────────────────────────────────────── */

const qualifications: QualificationRow[] = [
  { code: 'QUA-01', name: 'ثانوية عامة',             isActive: true, level: 'ثانوي',     track: 'عام'    },
  { code: 'QUA-02', name: 'الثانوية الأزهرية',        isActive: true, level: 'ثانوي',     track: 'أزهري'  },
  { code: 'QUA-03', name: 'شهادة وافد',               isActive: true, level: 'ثانوي',     track: 'وافد'   },
  { code: 'QUA-04', name: 'IG',                       isActive: true, level: 'ثانوي',     track: 'أجنبي'  },
  { code: 'QUA-05', name: 'الدبلوم الأمريكي',         isActive: true, level: 'ثانوي',     track: 'أجنبي'  },
  { code: 'QUA-06', name: 'الباكلوريا الفرنسية',      isActive: true, level: 'ثانوي',     track: 'أجنبي'  },
  { code: 'QUA-07', name: 'دبلوم فنّي',                isActive: true, level: 'دبلوم',     track: 'عام'    },
  { code: 'QUA-08', name: 'بكالوريوس الحقوق',          isActive: true, level: 'بكالوريوس', track: 'حقوق'   },
  { code: 'QUA-09', name: 'بكالوريوس تجارة',           isActive: true, level: 'بكالوريوس', track: 'عام'    },
  { code: 'QUA-10', name: 'بكالوريوس هندسة',           isActive: true, level: 'بكالوريوس', track: 'عام'    },
  { code: 'QUA-11', name: 'بكالوريوس تربية رياضية',     isActive: true, level: 'بكالوريوس', track: 'خاص'    },
  { code: 'QUA-12', name: 'دبلوم عالٍ',                isActive: true, level: 'دبلوم',     track: 'عام'    },
  { code: 'QUA-13', name: 'ماجستير',                  isActive: true, level: 'ماجستير',   track: 'عام'    },
  { code: 'QUA-14', name: 'دكتوراه',                   isActive: true, level: 'دكتوراه',   track: 'عام'    },
];

/* ─── 15. announcements — general application notices ─────────────────── */

const announcements: AnnouncementRow[] = [
  {
    code: 'ANN-01',
    name: 'فتح باب التقديم لدورة 2026',
    isActive: true,
    categoryCode: null,
    gender: 'any',
    divisionCode: null,
    publishAt: '2026-05-01T08:00:00.000Z',
    expireAt: '2026-07-31T23:59:00.000Z',
    body: 'تعلن أكاديمية الشرطة عن فتح باب التقديم لدورة 2026 لجميع الفئات. آخر موعد للتقديم: 31 يوليو 2026.',
  },
  {
    code: 'ANN-02',
    name: 'مواعيد اختبارات الذكور — علمي',
    isActive: true,
    categoryCode: 'CAT-01',
    gender: 'male',
    divisionCode: 'DIV-01',
    publishAt: '2026-06-01T08:00:00.000Z',
    expireAt: '2026-06-30T23:59:00.000Z',
    body: 'تبدأ اختبارات المتقدمين الذكور من شعبة علمي علوم يوم الأحد 14 يونيو 2026.',
  },
  {
    code: 'ANN-03',
    name: 'مواعيد اختبارات الإناث',
    isActive: true,
    categoryCode: 'CAT-02',
    gender: 'female',
    divisionCode: null,
    publishAt: '2026-06-01T08:00:00.000Z',
    expireAt: '2026-06-30T23:59:00.000Z',
    body: 'تبدأ اختبارات المتقدمات يوم الاثنين 15 يونيو 2026.',
  },
  {
    code: 'ANN-04',
    name: 'متطلبات الأزهر الشريف',
    isActive: true,
    categoryCode: 'CAT-03',
    gender: 'any',
    divisionCode: null,
    publishAt: '2026-05-15T08:00:00.000Z',
    expireAt: null,
    body: 'على متقدمي الأزهر الشريف إحضار شهادة المعادلة الأزهرية الأصلية + 4 صور شخصية.',
  },
];

/* ─── 16. applicant-divisions ────────────────────────────────────────── */

const applicantDivisions: ApplicantDivisionRow[] = [
  { code: 'DIV-01', name: 'علمي علوم',     ...active },
  { code: 'DIV-02', name: 'علمي رياضة',     ...active },
  { code: 'DIV-03', name: 'أدبي',           ...active },
  { code: 'DIV-04', name: 'أزهري علمي',     ...active },
  { code: 'DIV-05', name: 'أزهري أدبي',     ...active },
];

/* ─── 17. school-categories ──────────────────────────────────────────── */

/* Two conceptual axes share this lookup. The first 5 entries are the
 * certificate-source axis (where grades come from — drives
 * `externalGradesImport`). The SCH-A* rows are the school-administration
 * axis (حكومي / تجريبي / خاص / لغات / دولي / أزهري) — surfaced as a filter
 * + column on `/admin/applicant-grades` and as a mappable target field
 * in the import wizard. Both axes coexist here so the lookup remains
 * the single source of truth for "فئة المدرسة" labels. */
const schoolCategories: SchoolCategoryRow[] = [
  { code: 'SCH-01', name: 'الثانوية العامة',                                isActive: true, externalGradesImport: true  },
  { code: 'SCH-03', name: 'الثانوية الأزهرية',                              isActive: true, externalGradesImport: true  },
  { code: 'SCH-05', name: 'الشهادات المعادلة من الخارج',                    isActive: true, externalGradesImport: false },
  { code: 'SCH-06', name: 'الدبلومات الأجنبية',                             isActive: true, externalGradesImport: false },
  { code: 'SCH-07', name: 'مدارس المتفوقين في العلوم والتكنولوجيا STEM',   isActive: true, externalGradesImport: true  },
  { code: 'SCH-A1', name: 'حكومي',                                          isActive: true, externalGradesImport: false },
  { code: 'SCH-A2', name: 'تجريبي',                                         isActive: true, externalGradesImport: false },
  { code: 'SCH-A3', name: 'خاص',                                            isActive: true, externalGradesImport: false },
  { code: 'SCH-A4', name: 'لغات',                                           isActive: true, externalGradesImport: false },
  { code: 'SCH-A5', name: 'دولي',                                           isActive: true, externalGradesImport: false },
  { code: 'SCH-A6', name: 'أزهري',                                          isActive: true, externalGradesImport: false },
];

/* ─── 18. nid-missing-reasons ────────────────────────────────────────── */

const nidMissingReasons: NidMissingReasonRow[] = [
  { code: 'NMR-01', name: 'لم يبلغ سن استخراج البطاقة', isActive: true, requiresUpload: true  },
  { code: 'NMR-02', name: 'البطاقة قيد الإصدار',         isActive: true, requiresUpload: true  },
  { code: 'NMR-03', name: 'البطاقة مفقودة',              isActive: true, requiresUpload: true  },
  { code: 'NMR-04', name: 'البطاقة تالفة',               isActive: true, requiresUpload: true  },
  { code: 'NMR-05', name: 'غير مصري الجنسية',            isActive: true, requiresUpload: false },
  { code: 'NMR-06', name: 'أخرى',                        isActive: true, requiresUpload: true  },
];

/* ─── 18. universities — standalone, no FK to other lookups ─────────── */

const universities: UniversityRow[] = [
  { code: 'UNI-01', name: 'جامعة القاهرة',                   ...active },
  { code: 'UNI-02', name: 'جامعة عين شمس',                   ...active },
  { code: 'UNI-03', name: 'جامعة الإسكندرية',                ...active },
  { code: 'UNI-04', name: 'جامعة المنصورة',                  ...active },
  { code: 'UNI-05', name: 'جامعة أسيوط',                     ...active },
  { code: 'UNI-06', name: 'جامعة الزقازيق',                  ...active },
  { code: 'UNI-07', name: 'جامعة طنطا',                      ...active },
  { code: 'UNI-08', name: 'جامعة المنوفية',                  ...active },
  { code: 'UNI-09', name: 'جامعة بنها',                      ...active },
  { code: 'UNI-10', name: 'جامعة بني سويف',                  ...active },
  { code: 'UNI-11', name: 'جامعة الفيوم',                    ...active },
  { code: 'UNI-12', name: 'جامعة سوهاج',                     ...active },
  { code: 'UNI-13', name: 'جامعة جنوب الوادي (قنا)',          ...active },
  { code: 'UNI-14', name: 'جامعة أسوان',                     ...active },
  { code: 'UNI-15', name: 'جامعة كفر الشيخ',                  ...active },
  { code: 'UNI-16', name: 'جامعة دمياط',                     ...active },
  { code: 'UNI-17', name: 'جامعة بورسعيد',                   ...active },
  { code: 'UNI-18', name: 'جامعة السويس',                    ...active },
  { code: 'UNI-19', name: 'جامعة العريش',                    ...active },
  { code: 'UNI-20', name: 'جامعة مطروح',                     ...active },
  { code: 'UNI-21', name: 'جامعة الأزهر',                    ...active },
  { code: 'UNI-22', name: 'جامعة حلوان',                     ...active },
  { code: 'UNI-23', name: 'الجامعة الأمريكية بالقاهرة',       ...active },
  { code: 'UNI-24', name: 'الجامعة الألمانية بالقاهرة',        ...active },
  { code: 'UNI-25', name: 'الجامعة البريطانية في مصر',         ...active },
  { code: 'UNI-26', name: 'الجامعة الفرنسية',                 ...active },
  { code: 'UNI-27', name: 'جامعة 6 أكتوبر',                   ...active },
  { code: 'UNI-28', name: 'جامعة مصر للعلوم والتكنولوجيا',     ...active },
  { code: 'UNI-29', name: 'جامعة النيل',                      ...active },
  { code: 'UNI-30', name: 'جامعة المستقبل',                   ...active },
];

/* ─── 19. marital-statuses ─────────────────────────────────────────────
 *
 * Replaces the in-feature placeholder at
 * `admission-setup/lib/maritalStatuses.ts`. Codes follow the per-lookup
 * 2-digit padding documented in LOOKUP_META — the patch's proposed
 * 3-digit codes (`MAR-001`) were normalised to match local convention
 * (SUB-NNN is the outlier, not the rule). */

const maritalStatuses: MaritalStatusRow[] = [
  { code: 'MAR-01', name: 'أعزب',  nameEn: 'Single',   ...active },
  { code: 'MAR-02', name: 'متزوج', nameEn: 'Married',  ...active },
  { code: 'MAR-03', name: 'مطلق',  nameEn: 'Divorced', ...active },
  { code: 'MAR-04', name: 'أرمل',  nameEn: 'Widowed',  ...active },
];

/* ─── 20. academic-grades — التقدير ────────────────────────────────────
 *
 * Standard Egyptian university grade ladder. `metadata.minPercentage` /
 * `metadata.maxPercentage` are inclusive bounds — read via
 * `readPercentageRange(row)` from `../lib/academicGrade.ts`. Surfaced as
 * a hint under the picked تقدير in the application-settings year row
 * when the parent category's submission-type has `gradingMode = 'TAGDIR'`. */

const academicGrades: AcademicGradeRow[] = [
  {
    code: 'AGR-01',
    name: 'امتياز',
    nameEn: 'Excellent',
    isActive: true,
    metadata: { minPercentage: 85, maxPercentage: 100 },
  },
  {
    code: 'AGR-02',
    name: 'جيد جداً',
    nameEn: 'Very Good',
    isActive: true,
    metadata: { minPercentage: 75, maxPercentage: 84 },
  },
  {
    code: 'AGR-03',
    name: 'جيد',
    nameEn: 'Good',
    isActive: true,
    metadata: { minPercentage: 65, maxPercentage: 74 },
  },
  {
    code: 'AGR-04',
    name: 'مقبول',
    nameEn: 'Pass',
    isActive: true,
    metadata: { minPercentage: 50, maxPercentage: 64 },
  },
];

/* ─── 21. academic-degrees — الدرجة العلمية ────────────────────────────
 *
 * Standard tertiary degree ladder. Scopes which academic degree a
 * committee accepts on /admin/committee/create. */

const academicDegrees: AcademicDegreeRow[] = [
  { code: 'DEG-01', name: 'بكالوريوس', ...active },
  { code: 'DEG-02', name: 'ماجستير',   ...active },
  { code: 'DEG-03', name: 'دكتوراه',   ...active },
];

/** Public, typed seed of the academic-degree lookup — consumers can import
 *  this directly instead of going through `useLookup('academic-degrees')`. */
export const ACADEMIC_DEGREES: ReadonlyArray<AcademicDegreeRow> = academicDegrees;

/* ─── 22. exam-rounds — دور الامتحان ────────────────────────────────────
 *
 * Two-round Thanaweya structure. Picked by the Thanaweya admission rules
 * form so admins can scope a row to applicants who passed in either the
 * first or the second round. */

const examRounds: ExamRoundRow[] = [
  { code: 'ROUND-01', name: 'الدور الأول',  ...active },
  { code: 'ROUND-02', name: 'الدور الثاني', ...active },
];

/* ─── 23. graduation-years — سنوات التخرج ──────────────────────────────
 *
 * Admin-managed list of graduation years referenced by the
 * application-settings year rows (`graduationYears: number[]`). Codes
 * embed the year so the auto-increment next-code helper proposes the
 * following year naturally (e.g. `GYR-2027` → `GYR-2028`). */

const graduationYears: GraduationYearRow[] = [
  { code: 'GYR-2024', name: '2024', year: 2024, ...active },
  { code: 'GYR-2025', name: '2025', year: 2025, ...active },
  { code: 'GYR-2026', name: '2026', year: 2026, ...active },
];

/* ─── Aggregate — `MOCK.lookups[key]` ────────────────────────────────── */

export const LOOKUPS_SEED: { [K in LookupKey]: LookupRow<K>[] } = {
  'relationships': relationships,
  'relationship-degree-tiers': relationshipDegreeTiers,
  'tests': tests,
  'test-results': testResults,
  'committees': committees,
  'specializations': specializations,
  'faculties': faculties,
  'submission-types': submissionTypes,
  'applicant-categories': applicantCategories,
  'nationalities-countries': nationalitiesCountries,
  'governorates': governorates,
  'police-stations': policeStations,
  'jobs': jobs,
  'qualifications': qualifications,
  'announcements': announcements,
  'applicant-divisions': applicantDivisions,
  'school-categories': schoolCategories,
  'nid-missing-reasons': nidMissingReasons,
  'universities': universities,
  'marital-statuses': maritalStatuses,
  'academic-grades': academicGrades,
  'academic-degrees': academicDegrees,
  'exam-rounds': examRounds,
  'graduation-years': graduationYears,
};
