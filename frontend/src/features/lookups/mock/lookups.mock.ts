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
  AnnouncementRow,
  ApplicantCategoryRow,
  ApplicantDivisionRow,
  CommitteeRow,
  FacultyRow,
  GovernorateRow,
  JobRow,
  LookupKey,
  LookupRow,
  NationalityCountryRow,
  NidMissingReasonRow,
  PoliceStationRow,
  QualificationRow,
  RelationshipDegreeTierRow,
  RelationshipRow,
  SchoolCategoryRow,
  SpecializationRow,
  TestResultRow,
  TestRow,
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
  { code: 'TST-01', name: 'القدرات',               isActive: true, kind: 'written',   order: 10,  required: true },
  { code: 'TST-02', name: 'المعلومات العامة',       isActive: true, kind: 'written',   order: 20,  required: true },
  { code: 'TST-03', name: 'الطول',                 isActive: true, kind: 'medical',   order: 30,  required: true },
  { code: 'TST-04', name: 'السمات الخارجية',        isActive: true, kind: 'interview', order: 40,  required: true },
  { code: 'TST-05', name: 'السمات الداخلية',        isActive: true, kind: 'interview', order: 50,  required: true },
  { code: 'TST-06', name: 'اللياقة الرياضية',       isActive: true, kind: 'physical',  order: 60,  required: true },
  { code: 'TST-07', name: 'إعادة الرياضي',          isActive: true, kind: 'physical',  order: 70,  required: false },
  { code: 'TST-08', name: 'الهيئة',                isActive: true, kind: 'interview', order: 80,  required: true },
  { code: 'TST-09', name: 'القوام',                isActive: true, kind: 'medical',   order: 90,  required: true },
  { code: 'TST-10', name: 'إعادة القوام',           isActive: true, kind: 'medical',   order: 100, required: false },
  { code: 'TST-11', name: 'الكشف الطبي',           isActive: true, kind: 'medical',   order: 110, required: true },
  { code: 'TST-12', name: 'إعادة الطبي',           isActive: true, kind: 'medical',   order: 120, required: false },
  { code: 'TST-13', name: 'الاتزان النفسي',         isActive: true, kind: 'psych',     order: 130, required: true },
  { code: 'TST-14', name: 'الكشف الطبي المتقدم',    isActive: true, kind: 'medical',   order: 140, required: true },
  { code: 'TST-15', name: 'المقابلة الشخصية',       isActive: true, kind: 'interview', order: 150, required: true },
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
  { code: 'CMT-01', name: 'لجنة تسجيل البيانات',    isActive: true, kind: 'primary',     chairTitle: 'رئيس لجنة التسجيل' },
  { code: 'CMT-02', name: 'لجنة المقابلة الشخصية',  isActive: true, kind: 'interview',   chairTitle: 'رئيس لجنة المقابلة' },
  { code: 'CMT-03', name: 'لجنة القدرات',           isActive: true, kind: 'capacities',  chairTitle: 'رئيس لجنة القدرات' },
  { code: 'CMT-04', name: 'لجنة السمات',            isActive: true, kind: 'traits',      chairTitle: 'رئيس لجنة السمات' },
  { code: 'CMT-05', name: 'لجنة الكشف الطبي',       isActive: true, kind: 'medical',     chairTitle: 'رئيس القومسيون الطبي' },
  { code: 'CMT-06', name: 'لجنة الكشف الرياضي',     isActive: true, kind: 'sports',      chairTitle: 'رئيس لجنة الرياضة' },
  { code: 'CMT-07', name: 'لجنة المراجعة النهائية', isActive: true, kind: 'final',       chairTitle: 'رئيس لجنة المراجعة' },
  { code: 'CMT-08', name: 'لجنة التحريات',          isActive: true, kind: 'primary',     chairTitle: 'رئيس لجنة التحريات' },
];

/* ─── 6. specializations — police specializations ────────────────────── */

/* Each specialization now carries `facultyCode` directly — the old
 * junction table is gone. Mappings preserved from the prior
 * specialization-faculty-map seed; specializations that were mapped to
 * more than one faculty (e.g. الإدارة العامة under both عليا and
 * معاونين) collapse to one primary faculty per the prompt. */
const specializations: SpecializationRow[] = [
  { code: 'SPC-01', name: 'علوم شرطة',          isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-02', name: 'الأمن العام',         isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-03', name: 'الأمن المركزي',      isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-04', name: 'الأمن الإلكتروني',    isActive: true, facultyCode: 'FAC-02' },
  { code: 'SPC-05', name: 'مكافحة المخدرات',     isActive: true, facultyCode: 'FAC-02' },
  { code: 'SPC-06', name: 'حماية الآداب',        isActive: true, facultyCode: 'FAC-02' },
  { code: 'SPC-07', name: 'المرور',             isActive: true, facultyCode: 'FAC-01' },
  { code: 'SPC-08', name: 'الجوازات والهجرة',    isActive: true, facultyCode: 'FAC-02' },
  { code: 'SPC-09', name: 'الأحوال المدنية',     isActive: true, facultyCode: 'FAC-04' },
  { code: 'SPC-10', name: 'الإدارة العامة',      isActive: true, facultyCode: 'FAC-03' },
  { code: 'SPC-11', name: 'الأمن الاجتماعي',     isActive: true, facultyCode: 'FAC-03' },
  { code: 'SPC-12', name: 'مكافحة الإرهاب',     isActive: true, facultyCode: 'FAC-02' },
];

/* ─── 7. faculties — Police Academy faculties ────────────────────────── */

const faculties: FacultyRow[] = [
  { code: 'FAC-01', name: 'كلية الضباط',          ...active },
  { code: 'FAC-02', name: 'كلية الضباط المتخصصين', ...active },
  { code: 'FAC-03', name: 'كلية الدراسات العليا',  ...active },
  { code: 'FAC-04', name: 'كلية المعاونين',        ...active },
];

/* The old specialization-faculty-map junction table was removed in
 * favour of a direct `facultyCode` FK on each SpecializationRow above. */

/* ─── 9. applicant-categories ────────────────────────────────────────── */

const applicantCategories: ApplicantCategoryRow[] = [
  { code: 'CAT-01', name: 'ثانوية عامة — ذكور',          isActive: true, genderScope: 'male',   applicationMode: 'general' },
  { code: 'CAT-02', name: 'ثانوية عامة — إناث',          isActive: true, genderScope: 'female', applicationMode: 'general' },
  { code: 'CAT-03', name: 'الأزهر الشريف',                isActive: true, genderScope: 'any',    applicationMode: 'general' },
  { code: 'CAT-04', name: 'الضباط المتخصصون',             isActive: true, genderScope: 'any',    applicationMode: 'nomination' },
  { code: 'CAT-05', name: 'تربية رياضية',                 isActive: true, genderScope: 'any',    applicationMode: 'general' },
  { code: 'CAT-06', name: 'حقوق',                         isActive: true, genderScope: 'any',    applicationMode: 'general' },
  { code: 'CAT-07', name: 'حاملو شهادات أجنبية',           isActive: true, genderScope: 'any',    applicationMode: 'general' },
  { code: 'CAT-08', name: 'الدراسات العليا',              isActive: true, genderScope: 'any',    applicationMode: 'nomination' },
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

const schoolCategories: SchoolCategoryRow[] = [
  { code: 'SCH-01', name: 'حكومي',     ...active },
  { code: 'SCH-02', name: 'خاص',       ...active },
  { code: 'SCH-03', name: 'تجريبي',    ...active },
  { code: 'SCH-04', name: 'لغات',      ...active },
  { code: 'SCH-05', name: 'أزهري',     ...active },
  { code: 'SCH-06', name: 'دولي',      ...active },
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

/* ─── Aggregate — `MOCK.lookups[key]` ────────────────────────────────── */

export const LOOKUPS_SEED: { [K in LookupKey]: LookupRow<K>[] } = {
  'relationships': relationships,
  'relationship-degree-tiers': relationshipDegreeTiers,
  'tests': tests,
  'test-results': testResults,
  'committees': committees,
  'specializations': specializations,
  'faculties': faculties,
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
};
