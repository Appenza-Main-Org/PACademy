/**
 * Lookup Management Module — seed data.
 *
 * Single source of truth for the 31 lookup type codes and the
 * `lookup_items` rows that ship with the platform. All entries are
 * deterministic: codes/IDs/Arabic names are fixed strings, not rng()'d.
 *
 * Hierarchical types thread `parentId` through `LK-<TYPE>-<CODE>` IDs.
 * Sort orders increment by 10 within each parent scope so reorder UX has
 * room.
 *
 * Backend integration target: rows materialize into `dbo.lookup_types`
 * (the 31 type registry rows) and `dbo.lookup_items` (everything else).
 * The four mapping tables — see `LookupMappings` — materialize into four
 * junctions documented in `docs/DB_CONSTRAINTS.md §10`.
 */

import type {
  LookupItem,
  LookupMappings,
  LookupType,
  LookupTypeCode,
} from '../types';
import { HIERARCHICAL_TYPES } from '../types';

/* ─── Time constant ────────────────────────────────────────────────── */

const SEED_TIME = '2026-01-01T00:00:00.000Z';

/* ─── Helper ────────────────────────────────────────────────────────── */

const item = (
  typeCode: LookupTypeCode,
  code: string,
  nameAr: string,
  options: Partial<Omit<LookupItem, 'id' | 'lookupTypeCode' | 'code' | 'nameAr'>> = {},
): LookupItem => ({
  id: `LK-${typeCode}-${code}`,
  lookupTypeCode: typeCode,
  parentId: null,
  code,
  nameAr,
  nameEn: null,
  description: null,
  sortOrder: 10,
  isActive: true,
  metadata: null,
  startDate: null,
  endDate: null,
  createdAt: SEED_TIME,
  createdBy: 'system',
  updatedAt: SEED_TIME,
  updatedBy: 'system',
  deletedAt: null,
  ...options,
});

const id = (typeCode: LookupTypeCode, code: string): string => `LK-${typeCode}-${code}`;

/* ─── Type registry (31 rows) ────────────────────────────────────────── */

const TYPE_LABELS: Record<LookupTypeCode, { ar: string; en: string }> = {
  RELATIONSHIP_CATEGORY: { ar: 'درجات القرابة', en: 'Relationship categories' },
  TESTS: { ar: 'الاختبارات', en: 'Tests' },
  TEST_MODELS: { ar: 'نماذج الاختبارات', en: 'Test models' },
  SPECIALIZATIONS: { ar: 'التخصصات', en: 'Specializations' },
  UNIVERSITIES: { ar: 'الجامعات', en: 'Universities' },
  FACULTIES: { ar: 'الكليات', en: 'Faculties' },
  APPLICANT_CATEGORIES: { ar: 'فئات المتقدمين', en: 'Applicant categories' },
  COMMITTEES: { ar: 'لجان القبول', en: 'Admission committees' },
  ACADEMIC_GRADES: { ar: 'التقديرات الأكاديمية', en: 'Academic grades' },
  EDUCATIONAL_ENTITY_RANKING: { ar: 'تصنيف الجهات التعليمية', en: 'Educational entity ranking' },
  COUNTRIES: { ar: 'الدول', en: 'Countries' },
  GOVERNORATES: { ar: 'المحافظات', en: 'Governorates' },
  POLICE_DEPARTMENTS: { ar: 'الأقسام والمراكز', en: 'Police departments' },
  JOBS: { ar: 'الوظائف', en: 'Jobs' },
  QUALIFICATIONS: { ar: 'المؤهلات', en: 'Qualifications' },
  ADMISSION_PERIODS: { ar: 'فترات التقديم', en: 'Admission periods' },
  APPLICANT_NETWORK: { ar: 'شبكة المتقدمين', en: 'Applicant network' },
  SCHOOL_LANGUAGE: { ar: 'لغة المدرسة', en: 'School language' },
  FOREIGN_APPLICANTS: { ar: 'المتقدمون الأجانب', en: 'Foreign applicants' },
  EDUCATION_LEVELS: { ar: 'المراحل التعليمية', en: 'Education levels' },
  EDUCATION_TYPES: { ar: 'فئة المدرسة', en: 'Education types' },
  MARITAL_STATUSES: { ar: 'الحالة الاجتماعية', en: 'Marital statuses' },
  SPECIALTIES: { ar: 'التخصصات الفرعية', en: 'Sub-specialties' },
  SPECIALTY_TYPES: { ar: 'أنواع التخصصات', en: 'Specialty types' },
  DEGREE_TYPES: { ar: 'أنواع الشهادات', en: 'Degree types' },
  EXAM_TYPES: { ar: 'أنواع الاختبارات', en: 'Exam types' },
  EXAM_GROUPS: { ar: 'مجموعات الاختبارات', en: 'Exam groups' },
  COMMITTEE_TYPES: { ar: 'أنواع اللجان', en: 'Committee types' },
  REJECTION_REASONS: { ar: 'أسباب الرفض', en: 'Rejection reasons' },
  NOTIFICATION_DEPARTMENTS: { ar: 'أقسام الإشعارات', en: 'Notification departments' },
  APPLICANT_SECTIONS: { ar: 'شعبة المتقدمين', en: 'Applicant sections' },
  NATIONAL_ID_MISSING_REASONS: { ar: 'أسباب تعذر وجود رقم قومي', en: 'National ID missing reasons' },
  NATIONALITIES: { ar: 'الجنسيات', en: 'Nationalities' },
  CASE_TYPES: { ar: 'أنواع القضايا', en: 'Case types' },
};

export const LOOKUP_TYPES: LookupType[] = (Object.keys(TYPE_LABELS) as LookupTypeCode[]).map(
  (code, index) => ({
    id: `LT-${code}`,
    code,
    nameAr: TYPE_LABELS[code].ar,
    nameEn: TYPE_LABELS[code].en,
    isHierarchical: HIERARCHICAL_TYPES.has(code),
    isActive: true,
    sortOrder: (index + 1) * 10,
  }) as LookupType,
);

/* ─── Hierarchical seeds ─────────────────────────────────────────────── */

/* RELATIONSHIP_CATEGORY — 10 rows (typed-as-hierarchical but flat).
 * Codes preserve the existing REL-NN pattern so backward references hold. */
const relationshipCategoryItems: LookupItem[] = [
  item('RELATIONSHIP_CATEGORY', 'REL-001', 'الأب',     { sortOrder: 10 }),
  item('RELATIONSHIP_CATEGORY', 'REL-002', 'الأم',     { sortOrder: 20 }),
  item('RELATIONSHIP_CATEGORY', 'REL-003', 'أخ',       { sortOrder: 30 }),
  item('RELATIONSHIP_CATEGORY', 'REL-004', 'أخت',      { sortOrder: 40 }),
  item('RELATIONSHIP_CATEGORY', 'REL-005', 'عم',       { sortOrder: 50 }),
  item('RELATIONSHIP_CATEGORY', 'REL-006', 'عمة',      { sortOrder: 60 }),
  item('RELATIONSHIP_CATEGORY', 'REL-007', 'خال',      { sortOrder: 70 }),
  item('RELATIONSHIP_CATEGORY', 'REL-008', 'خالة',     { sortOrder: 80 }),
  item('RELATIONSHIP_CATEGORY', 'REL-009', 'جد',       { sortOrder: 90 }),
  item('RELATIONSHIP_CATEGORY', 'REL-010', 'جدة',      { sortOrder: 100 }),
];

/* TESTS — 3 roots + children. */
const testsItems: LookupItem[] = [
  // Roots
  item('TESTS', 'TEST-001', 'اختبارات القبول',  { sortOrder: 10 }),
  item('TESTS', 'TEST-002', 'اختبارات طبية',    { sortOrder: 20 }),
  item('TESTS', 'TEST-003', 'اختبارات رياضية',  { sortOrder: 30 }),
  // Children of TEST-001 (اختبارات القبول)
  item('TESTS', 'TEST-101', 'اختبار القدرات',         { sortOrder: 10, parentId: id('TESTS', 'TEST-001') }),
  item('TESTS', 'TEST-102', 'اختبار المعلومات العامة', { sortOrder: 20, parentId: id('TESTS', 'TEST-001') }),
  item('TESTS', 'TEST-103', 'اختبار اللغة',            { sortOrder: 30, parentId: id('TESTS', 'TEST-001') }),
  // Children of TEST-002 (طبية)
  item('TESTS', 'TEST-201', 'الكشف الطبي الأولي', { sortOrder: 10, parentId: id('TESTS', 'TEST-002') }),
  item('TESTS', 'TEST-202', 'الكشف الطبي المتقدم', { sortOrder: 20, parentId: id('TESTS', 'TEST-002') }),
  // Children of TEST-003 (رياضية)
  item('TESTS', 'TEST-301', 'اختبار اللياقة',  { sortOrder: 10, parentId: id('TESTS', 'TEST-003') }),
  item('TESTS', 'TEST-302', 'اختبار القوام',   { sortOrder: 20, parentId: id('TESTS', 'TEST-003') }),
];

/* TEST_MODELS — children of two TESTS leaves. */
const testModelsItems: LookupItem[] = [
  // Models of "اختبار القدرات" (TEST-101)
  item('TEST_MODELS', 'TM-001', 'النموذج A', { sortOrder: 10, parentId: id('TESTS', 'TEST-101') }),
  item('TEST_MODELS', 'TM-002', 'النموذج B', { sortOrder: 20, parentId: id('TESTS', 'TEST-101') }),
  item('TEST_MODELS', 'TM-003', 'النموذج C', { sortOrder: 30, parentId: id('TESTS', 'TEST-101') }),
  // Models of "اختبار المعلومات العامة" (TEST-102)
  item('TEST_MODELS', 'TM-101', 'مجموعة G1', { sortOrder: 10, parentId: id('TESTS', 'TEST-102') }),
  item('TEST_MODELS', 'TM-102', 'مجموعة G2', { sortOrder: 20, parentId: id('TESTS', 'TEST-102') }),
];

/* APPLICANT_CATEGORIES — 8 roots + ~12 subtree leaves. */
const applicantCategoriesItems: LookupItem[] = [
  item('APPLICANT_CATEGORIES', 'CAT-001', 'الثانوية العامة',                { sortOrder: 10 }),
  item('APPLICANT_CATEGORIES', 'CAT-002', 'الأزهر الشريف',                  { sortOrder: 20 }),
  item('APPLICANT_CATEGORIES', 'CAT-003', 'حاملو شهادات الإجازة',           { sortOrder: 30 }),
  item('APPLICANT_CATEGORIES', 'CAT-004', 'حاملو الشهادات العسكرية',         { sortOrder: 40 }),
  item('APPLICANT_CATEGORIES', 'CAT-005', 'حاملو شهادات أجنبية',            { sortOrder: 50 }),
  item('APPLICANT_CATEGORIES', 'CAT-006', 'تربية رياضية',                   { sortOrder: 60 }),
  item('APPLICANT_CATEGORIES', 'CAT-007', 'حقوق',                          { sortOrder: 70 }),
  item('APPLICANT_CATEGORIES', 'CAT-008', 'حاملو الدراسات العليا',          { sortOrder: 80 }),
  // CAT-001 (ثانوية عامة) sub-tree
  item('APPLICANT_CATEGORIES', 'CAT-101', 'علمي علوم',  { sortOrder: 10, parentId: id('APPLICANT_CATEGORIES', 'CAT-001') }),
  item('APPLICANT_CATEGORIES', 'CAT-102', 'علمي رياضة', { sortOrder: 20, parentId: id('APPLICANT_CATEGORIES', 'CAT-001') }),
  item('APPLICANT_CATEGORIES', 'CAT-103', 'أدبي',       { sortOrder: 30, parentId: id('APPLICANT_CATEGORIES', 'CAT-001') }),
  // CAT-002 (أزهر) sub-tree
  item('APPLICANT_CATEGORIES', 'CAT-201', 'أزهر علمي', { sortOrder: 10, parentId: id('APPLICANT_CATEGORIES', 'CAT-002') }),
  item('APPLICANT_CATEGORIES', 'CAT-202', 'أزهر أدبي', { sortOrder: 20, parentId: id('APPLICANT_CATEGORIES', 'CAT-002') }),
  // CAT-005 (شهادات أجنبية) sub-tree
  item('APPLICANT_CATEGORIES', 'CAT-501', 'IG',                    { sortOrder: 10, parentId: id('APPLICANT_CATEGORIES', 'CAT-005') }),
  item('APPLICANT_CATEGORIES', 'CAT-502', 'الدبلوم الأمريكي',       { sortOrder: 20, parentId: id('APPLICANT_CATEGORIES', 'CAT-005') }),
  item('APPLICANT_CATEGORIES', 'CAT-503', 'الباكلوريا الفرنسية',    { sortOrder: 30, parentId: id('APPLICANT_CATEGORIES', 'CAT-005') }),
  // CAT-008 (دراسات عليا) sub-tree
  item('APPLICANT_CATEGORIES', 'CAT-801', 'دبلوم عالٍ', { sortOrder: 10, parentId: id('APPLICANT_CATEGORIES', 'CAT-008') }),
  item('APPLICANT_CATEGORIES', 'CAT-802', 'ماجستير',    { sortOrder: 20, parentId: id('APPLICANT_CATEGORIES', 'CAT-008') }),
  item('APPLICANT_CATEGORIES', 'CAT-803', 'دكتوراه',     { sortOrder: 30, parentId: id('APPLICANT_CATEGORIES', 'CAT-008') }),
];

/* COUNTRIES → GOVERNORATES → POLICE_DEPARTMENTS chain.
 * مصر is the root with 27 governorates. Foreign countries seeded as
 * leaves under their own COUNTRIES roots. */
const countriesItems: LookupItem[] = [
  item('COUNTRIES', 'CTR-001', 'مصر',       { sortOrder: 10 }),
  item('COUNTRIES', 'CTR-002', 'السعودية',  { sortOrder: 20 }),
  item('COUNTRIES', 'CTR-003', 'الإمارات',   { sortOrder: 30 }),
  item('COUNTRIES', 'CTR-004', 'الكويت',    { sortOrder: 40 }),
  item('COUNTRIES', 'CTR-005', 'السودان',   { sortOrder: 50 }),
];

const EGYPT_ID = id('COUNTRIES', 'CTR-001');

const governorateNames = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية',
  'المنوفية', 'القليوبية', 'بني سويف', 'الفيوم', 'المنيا',
  'أسيوط', 'سوهاج', 'قنا', 'أسوان', 'البحر الأحمر',
  'الوادي الجديد', 'مرسى مطروح', 'شمال سيناء', 'جنوب سيناء', 'بورسعيد',
  'دمياط', 'كفر الشيخ', 'الغربية', 'الإسماعيلية', 'السويس',
  'الأقصر', 'البحيرة',
] as const;

const governoratesItems: LookupItem[] = governorateNames.map((name, i) =>
  item('GOVERNORATES', `GOV-${String(i + 1).padStart(3, '0')}`, name, {
    sortOrder: (i + 1) * 10,
    parentId: EGYPT_ID,
  }),
);

/* POLICE_DEPARTMENTS — sample a handful per governorate; demo data
 * doesn't need exhaustive coverage. */
const policeDepartmentsItems: LookupItem[] = [
  // Under القاهرة (GOV-001)
  item('POLICE_DEPARTMENTS', 'DEP-001', 'قسم عابدين',     { sortOrder: 10, parentId: id('GOVERNORATES', 'GOV-001') }),
  item('POLICE_DEPARTMENTS', 'DEP-002', 'قسم السيدة زينب', { sortOrder: 20, parentId: id('GOVERNORATES', 'GOV-001') }),
  item('POLICE_DEPARTMENTS', 'DEP-003', 'قسم مصر القديمة',  { sortOrder: 30, parentId: id('GOVERNORATES', 'GOV-001') }),
  item('POLICE_DEPARTMENTS', 'DEP-004', 'قسم النزهة',      { sortOrder: 40, parentId: id('GOVERNORATES', 'GOV-001') }),
  // Under الجيزة (GOV-002)
  item('POLICE_DEPARTMENTS', 'DEP-101', 'قسم الدقي',     { sortOrder: 10, parentId: id('GOVERNORATES', 'GOV-002') }),
  item('POLICE_DEPARTMENTS', 'DEP-102', 'قسم العجوزة',   { sortOrder: 20, parentId: id('GOVERNORATES', 'GOV-002') }),
  item('POLICE_DEPARTMENTS', 'DEP-103', 'قسم العمرانية', { sortOrder: 30, parentId: id('GOVERNORATES', 'GOV-002') }),
  // Under الإسكندرية (GOV-003)
  item('POLICE_DEPARTMENTS', 'DEP-201', 'قسم محرم بك',   { sortOrder: 10, parentId: id('GOVERNORATES', 'GOV-003') }),
  item('POLICE_DEPARTMENTS', 'DEP-202', 'قسم سيدي جابر',  { sortOrder: 20, parentId: id('GOVERNORATES', 'GOV-003') }),
  // Under الشرقية (GOV-005)
  item('POLICE_DEPARTMENTS', 'DEP-401', 'قسم الزقازيق', { sortOrder: 10, parentId: id('GOVERNORATES', 'GOV-005') }),
  item('POLICE_DEPARTMENTS', 'DEP-402', 'قسم بلبيس',    { sortOrder: 20, parentId: id('GOVERNORATES', 'GOV-005') }),
];

/* JOBS — 3 root categories + children. */
const jobsItems: LookupItem[] = [
  // Root categories
  item('JOBS', 'JOB-001', 'وظائف حكومية',  { sortOrder: 10 }),
  item('JOBS', 'JOB-002', 'وظائف خاصة',    { sortOrder: 20 }),
  item('JOBS', 'JOB-003', 'مهن حرة',       { sortOrder: 30 }),
  // Children of حكومية
  item('JOBS', 'JOB-101', 'مدرّس',           { sortOrder: 10, parentId: id('JOBS', 'JOB-001') }),
  item('JOBS', 'JOB-102', 'موظف حكومي',     { sortOrder: 20, parentId: id('JOBS', 'JOB-001') }),
  item('JOBS', 'JOB-103', 'ضابط شرطة',      { sortOrder: 30, parentId: id('JOBS', 'JOB-001') }),
  item('JOBS', 'JOB-104', 'ضابط قوات مسلحة', { sortOrder: 40, parentId: id('JOBS', 'JOB-001') }),
  // Children of خاصة
  item('JOBS', 'JOB-201', 'موظف قطاع خاص', { sortOrder: 10, parentId: id('JOBS', 'JOB-002') }),
  item('JOBS', 'JOB-202', 'رجل أعمال',     { sortOrder: 20, parentId: id('JOBS', 'JOB-002') }),
  // Children of حرة
  item('JOBS', 'JOB-301', 'مهندس',  { sortOrder: 10, parentId: id('JOBS', 'JOB-003') }),
  item('JOBS', 'JOB-302', 'طبيب',   { sortOrder: 20, parentId: id('JOBS', 'JOB-003') }),
  item('JOBS', 'JOB-303', 'محامٍ',  { sortOrder: 30, parentId: id('JOBS', 'JOB-003') }),
  item('JOBS', 'JOB-304', 'محاسب',  { sortOrder: 40, parentId: id('JOBS', 'JOB-003') }),
];

/* ─── Flat seeds ─────────────────────────────────────────────────────── */

const universitiesItems: LookupItem[] = [
  item('UNIVERSITIES', 'UNI-001', 'جامعة القاهرة',     { sortOrder: 10 }),
  item('UNIVERSITIES', 'UNI-002', 'جامعة عين شمس',     { sortOrder: 20 }),
  item('UNIVERSITIES', 'UNI-003', 'جامعة الإسكندرية',  { sortOrder: 30 }),
  item('UNIVERSITIES', 'UNI-004', 'جامعة المنصورة',    { sortOrder: 40 }),
  item('UNIVERSITIES', 'UNI-005', 'جامعة أسيوط',       { sortOrder: 50 }),
  item('UNIVERSITIES', 'UNI-006', 'جامعة حلوان',       { sortOrder: 60 }),
  item('UNIVERSITIES', 'UNI-007', 'جامعة الزقازيق',    { sortOrder: 70 }),
  item('UNIVERSITIES', 'UNI-008', 'أكاديمية الشرطة',    { sortOrder: 80 }),
];

const facultiesItems: LookupItem[] = [
  // Under جامعة القاهرة (UNI-001)
  item('FACULTIES', 'FAC-001', 'كلية الهندسة',  { sortOrder: 10, parentId: id('UNIVERSITIES', 'UNI-001') }),
  item('FACULTIES', 'FAC-002', 'كلية الحقوق',   { sortOrder: 20, parentId: id('UNIVERSITIES', 'UNI-001') }),
  item('FACULTIES', 'FAC-003', 'كلية التجارة',  { sortOrder: 30, parentId: id('UNIVERSITIES', 'UNI-001') }),
  // Under جامعة عين شمس (UNI-002)
  item('FACULTIES', 'FAC-004', 'كلية الطب',      { sortOrder: 10, parentId: id('UNIVERSITIES', 'UNI-002') }),
  item('FACULTIES', 'FAC-005', 'كلية الهندسة',  { sortOrder: 20, parentId: id('UNIVERSITIES', 'UNI-002') }),
  // Under أكاديمية الشرطة (UNI-008)
  item('FACULTIES', 'FAC-006', 'كلية الشرطة', { sortOrder: 10, parentId: id('UNIVERSITIES', 'UNI-008') }),
  // Under جامعة المنصورة (UNI-004)
  item('FACULTIES', 'FAC-007', 'كلية التربية الرياضية', { sortOrder: 10, parentId: id('UNIVERSITIES', 'UNI-004') }),
];

const specializationsItems: LookupItem[] = [
  item('SPECIALIZATIONS', 'SPC-001', 'علوم شرطة',         { sortOrder: 10 }),
  item('SPECIALIZATIONS', 'SPC-002', 'الأمن العام',        { sortOrder: 20 }),
  item('SPECIALIZATIONS', 'SPC-003', 'الأمن المركزي',     { sortOrder: 30 }),
  item('SPECIALIZATIONS', 'SPC-004', 'الأمن الإلكتروني',  { sortOrder: 40 }),
  item('SPECIALIZATIONS', 'SPC-005', 'مكافحة المخدرات',   { sortOrder: 50 }),
  item('SPECIALIZATIONS', 'SPC-006', 'حماية الآداب',       { sortOrder: 60 }),
  item('SPECIALIZATIONS', 'SPC-007', 'المرور',            { sortOrder: 70 }),
  item('SPECIALIZATIONS', 'SPC-008', 'الجوازات والهجرة',   { sortOrder: 80 }),
  item('SPECIALIZATIONS', 'SPC-009', 'الأحوال المدنية',    { sortOrder: 90 }),
  item('SPECIALIZATIONS', 'SPC-010', 'الإدارة العامة',     { sortOrder: 100 }),
];

const committeesItems: LookupItem[] = [
  item('COMMITTEES', 'COM-001', 'لجنة تسجيل البيانات',  { sortOrder: 10 }),
  item('COMMITTEES', 'COM-002', 'لجنة المقابلة الشخصية', { sortOrder: 20 }),
  item('COMMITTEES', 'COM-003', 'لجنة القدرات',         { sortOrder: 30 }),
  item('COMMITTEES', 'COM-004', 'لجنة السمات',          { sortOrder: 40 }),
  item('COMMITTEES', 'COM-005', 'لجنة الكشف الطبي',     { sortOrder: 50 }),
  item('COMMITTEES', 'COM-006', 'لجنة الكشف الرياضي',   { sortOrder: 60 }),
  item('COMMITTEES', 'COM-007', 'لجنة المراجعة النهائية', { sortOrder: 70 }),
  item('COMMITTEES', 'COM-008', 'لجنة التحريات',         { sortOrder: 80 }),
];

const academicGradesItems: LookupItem[] = [
  item('ACADEMIC_GRADES', 'GRD-001', 'ممتاز',    { sortOrder: 10, metadata: { minPercentage: 85, maxPercentage: 100 } }),
  item('ACADEMIC_GRADES', 'GRD-002', 'جيد جداً', { sortOrder: 20, metadata: { minPercentage: 75, maxPercentage: 84.99 } }),
  item('ACADEMIC_GRADES', 'GRD-003', 'جيد',     { sortOrder: 30, metadata: { minPercentage: 65, maxPercentage: 74.99 } }),
  item('ACADEMIC_GRADES', 'GRD-004', 'مقبول',   { sortOrder: 40, metadata: { minPercentage: 50, maxPercentage: 64.99 } }),
];

const educationalEntityRankingItems: LookupItem[] = [
  item('EDUCATIONAL_ENTITY_RANKING', 'EER-001', 'مدرسة حكومية', { sortOrder: 10 }),
  item('EDUCATIONAL_ENTITY_RANKING', 'EER-002', 'مدرسة خاصة',   { sortOrder: 20 }),
  item('EDUCATIONAL_ENTITY_RANKING', 'EER-003', 'مدرسة دولية',   { sortOrder: 30 }),
  item('EDUCATIONAL_ENTITY_RANKING', 'EER-004', 'مدرسة أزهرية',  { sortOrder: 40 }),
  item('EDUCATIONAL_ENTITY_RANKING', 'EER-005', 'تجريبية',        { sortOrder: 50 }),
];

const qualificationsItems: LookupItem[] = [
  item('QUALIFICATIONS', 'QUA-001', 'ثانوية عامة',       { sortOrder: 10 }),
  item('QUALIFICATIONS', 'QUA-002', 'الثانوية الأزهرية',  { sortOrder: 20 }),
  item('QUALIFICATIONS', 'QUA-003', 'دبلوم فنّي',        { sortOrder: 30 }),
  item('QUALIFICATIONS', 'QUA-004', 'بكالوريوس',         { sortOrder: 40 }),
  item('QUALIFICATIONS', 'QUA-005', 'ليسانس',            { sortOrder: 50 }),
  item('QUALIFICATIONS', 'QUA-006', 'دبلوم عالٍ',        { sortOrder: 60 }),
  item('QUALIFICATIONS', 'QUA-007', 'ماجستير',           { sortOrder: 70 }),
  item('QUALIFICATIONS', 'QUA-008', 'دكتوراه',            { sortOrder: 80 }),
];

const admissionPeriodsItems: LookupItem[] = [
  item('ADMISSION_PERIODS', 'AP-001', 'دورة 2026 — ذكور',  { sortOrder: 10 }),
  item('ADMISSION_PERIODS', 'AP-002', 'دورة 2026 — إناث', { sortOrder: 20 }),
  item('ADMISSION_PERIODS', 'AP-003', 'دورة استكمال 2025', { sortOrder: 30 }),
];

const applicantNetworkItems: LookupItem[] = [
  item('APPLICANT_NETWORK', 'NET-001', 'فيسبوك',                 { sortOrder: 10 }),
  item('APPLICANT_NETWORK', 'NET-002', 'الموقع الرسمي',          { sortOrder: 20 }),
  item('APPLICANT_NETWORK', 'NET-003', 'تويتر',                  { sortOrder: 30 }),
  item('APPLICANT_NETWORK', 'NET-004', 'إعلان تليفزيوني',         { sortOrder: 40 }),
  item('APPLICANT_NETWORK', 'NET-005', 'إحالة شخصية',             { sortOrder: 50 }),
];

const schoolLanguageItems: LookupItem[] = [
  item('SCHOOL_LANGUAGE', 'SL-001', 'عربي',     { sortOrder: 10 }),
  item('SCHOOL_LANGUAGE', 'SL-002', 'إنجليزي',  { sortOrder: 20 }),
  item('SCHOOL_LANGUAGE', 'SL-003', 'فرنسي',    { sortOrder: 30 }),
  item('SCHOOL_LANGUAGE', 'SL-004', 'ألماني',   { sortOrder: 40 }),
  item('SCHOOL_LANGUAGE', 'SL-005', 'إيطالي',   { sortOrder: 50 }),
];

const foreignApplicantsItems: LookupItem[] = [
  item('FOREIGN_APPLICANTS', 'FA-001', 'مقيم بمصر',                 { sortOrder: 10 }),
  item('FOREIGN_APPLICANTS', 'FA-002', 'وافد للقبول',               { sortOrder: 20 }),
  item('FOREIGN_APPLICANTS', 'FA-003', 'منحة حكومية',                { sortOrder: 30 }),
  item('FOREIGN_APPLICANTS', 'FA-004', 'منحة هيئات تعليمية',         { sortOrder: 40 }),
];

const educationLevelsItems: LookupItem[] = [
  item('EDUCATION_LEVELS', 'EL-001', 'ابتدائي',  { sortOrder: 10 }),
  item('EDUCATION_LEVELS', 'EL-002', 'إعدادي',  { sortOrder: 20 }),
  item('EDUCATION_LEVELS', 'EL-003', 'ثانوي',    { sortOrder: 30 }),
  item('EDUCATION_LEVELS', 'EL-004', 'جامعي',    { sortOrder: 40 }),
  item('EDUCATION_LEVELS', 'EL-005', 'دراسات عليا', { sortOrder: 50 }),
  item('EDUCATION_LEVELS', 'EL-006', 'مدارس فنية',  { sortOrder: 60 }),
];

/* ─── Extension seeds (preserve existing LookupKey consumers) ──────── */

/* Codes for these types preserve the legacy snake_case keys so seeded
 * category conditions / admission rules ('single', 'thanaweya_amma',
 * 'aptitude', …) keep resolving after the migration. */
const educationTypesItems: LookupItem[] = [
  item('EDUCATION_TYPES', 'thanaweya_amma',     'ثانوية عامة',       { sortOrder: 10 }),
  item('EDUCATION_TYPES', 'azhar',              'أزهر',              { sortOrder: 20 }),
  item('EDUCATION_TYPES', 'sports_education',   'تربية رياضية',      { sortOrder: 30 }),
  item('EDUCATION_TYPES', 'law',                'حقوق',              { sortOrder: 40 }),
  item('EDUCATION_TYPES', 'bachelor',           'بكالوريوس',         { sortOrder: 50 }),
  item('EDUCATION_TYPES', 'master',             'ماجستير',           { sortOrder: 60 }),
  item('EDUCATION_TYPES', 'phd',                'دكتوراه',           { sortOrder: 70 }),
  item('EDUCATION_TYPES', 'foreign_certificates','شهادات أجنبية',    { sortOrder: 80 }),
  item('EDUCATION_TYPES', 'ig',                 'IG',                { sortOrder: 90 }),
  item('EDUCATION_TYPES', 'american_diploma',   'الدبلوم الأمريكي',  { sortOrder: 100 }),
];

const maritalStatusesItems: LookupItem[] = [
  item('MARITAL_STATUSES', 'single',   'أعزب',  { sortOrder: 10 }),
  item('MARITAL_STATUSES', 'married',  'متزوج', { sortOrder: 20 }),
  item('MARITAL_STATUSES', 'divorced', 'مطلق',  { sortOrder: 30, isActive: false }),
  item('MARITAL_STATUSES', 'widowed',  'أرمل',  { sortOrder: 40, isActive: false }),
];

const specialtiesItems: LookupItem[] = [
  item('SPECIALTIES', 'SPL-001', 'هندسة مدنية',      { sortOrder: 10, parentId: id('FACULTIES', 'FAC-001') }),
  item('SPECIALTIES', 'SPL-002', 'هندسة كهربائية',   { sortOrder: 20, parentId: id('FACULTIES', 'FAC-001') }),
  item('SPECIALTIES', 'SPL-003', 'هندسة ميكانيكية',  { sortOrder: 30, parentId: id('FACULTIES', 'FAC-001') }),
  item('SPECIALTIES', 'SPL-004', 'محاسبة مالية',     { sortOrder: 10, parentId: id('FACULTIES', 'FAC-003') }),
  item('SPECIALTIES', 'SPL-005', 'محاسبة تكاليف',    { sortOrder: 20, parentId: id('FACULTIES', 'FAC-003') }),
];

const specialtyTypesItems: LookupItem[] = [
  item('SPECIALTY_TYPES', 'STY-001', 'هندسة',           { sortOrder: 10, parentId: id('FACULTIES', 'FAC-001') }),
  item('SPECIALTY_TYPES', 'STY-002', 'محاسبة',          { sortOrder: 20, parentId: id('FACULTIES', 'FAC-003') }),
  item('SPECIALTY_TYPES', 'STY-003', 'قانون',           { sortOrder: 30, parentId: id('FACULTIES', 'FAC-002') }),
  item('SPECIALTY_TYPES', 'STY-004', 'طب',              { sortOrder: 40, parentId: id('FACULTIES', 'FAC-004') }),
  item('SPECIALTY_TYPES', 'STY-005', 'علوم الحاسب',     { sortOrder: 50, parentId: id('FACULTIES', 'FAC-001') }),
  item('SPECIALTY_TYPES', 'STY-006', 'إدارة الأعمال',   { sortOrder: 60, parentId: id('FACULTIES', 'FAC-003') }),
];

const degreeTypesItems: LookupItem[] = [
  item('DEGREE_TYPES', 'DT-001', 'بكالوريوس',   { sortOrder: 10 }),
  item('DEGREE_TYPES', 'DT-002', 'ماجستير',     { sortOrder: 20 }),
  item('DEGREE_TYPES', 'DT-003', 'دكتوراه',      { sortOrder: 30 }),
  item('DEGREE_TYPES', 'DT-004', 'دبلوم عالٍ',  { sortOrder: 40 }),
];

const examTypesItems: LookupItem[] = [
  item('EXAM_TYPES', 'aptitude',            'القدرات',           { sortOrder: 10 }),
  item('EXAM_TYPES', 'height',              'الطول',              { sortOrder: 20 }),
  item('EXAM_TYPES', 'appearance_external', 'السمات الخارجي',    { sortOrder: 30 }),
  item('EXAM_TYPES', 'appearance_internal', 'السمات الداخلي',     { sortOrder: 40 }),
  item('EXAM_TYPES', 'physical',            'الرياضي',            { sortOrder: 50 }),
  item('EXAM_TYPES', 'physical_retake',     'إعادة الرياضي',       { sortOrder: 60 }),
  item('EXAM_TYPES', 'posture',             'الهيئة',              { sortOrder: 70 }),
  item('EXAM_TYPES', 'build',               'القوام',              { sortOrder: 80 }),
  item('EXAM_TYPES', 'build_retake',        'إعادة القوام',        { sortOrder: 90 }),
  item('EXAM_TYPES', 'medical',             'الطبي',               { sortOrder: 100 }),
  item('EXAM_TYPES', 'medical_retake',      'إعادة الطبي',         { sortOrder: 110 }),
  item('EXAM_TYPES', 'psychology',          'الاتزان النفسي',      { sortOrder: 120 }),
  item('EXAM_TYPES', 'medical_advanced',    'الطبي المتقدم',       { sortOrder: 130 }),
];

const examGroupsItems: LookupItem[] = [
  item('EXAM_GROUPS', 'EG-001', 'الاختبارات الأولية',         { sortOrder: 10 }),
  item('EXAM_GROUPS', 'EG-002', 'لجان القدرات والسمات',       { sortOrder: 20 }),
  item('EXAM_GROUPS', 'EG-003', 'الاختبارات الرياضية',         { sortOrder: 30 }),
  item('EXAM_GROUPS', 'EG-004', 'الاختبارات الطبية',           { sortOrder: 40 }),
  item('EXAM_GROUPS', 'EG-005', 'الاختبارات النفسية',          { sortOrder: 50 }),
  item('EXAM_GROUPS', 'EG-006', 'اختبارات الكلية',             { sortOrder: 60 }),
];

const committeeTypesItems: LookupItem[] = [
  item('COMMITTEE_TYPES', 'capacities', 'لجنة القدرات',  { sortOrder: 10 }),
  item('COMMITTEE_TYPES', 'traits',     'لجنة السمات',   { sortOrder: 20 }),
  item('COMMITTEE_TYPES', 'sports',     'لجنة الرياضة',  { sortOrder: 30 }),
  item('COMMITTEE_TYPES', 'interview',  'لجنة المقابلة', { sortOrder: 40 }),
];

const rejectionReasonsItems: LookupItem[] = [
  item('REJECTION_REASONS', 'RR-001', 'السن خارج المسموح به',     { sortOrder: 10 }),
  item('REJECTION_REASONS', 'RR-002', 'لا يطابق متطلبات النوع',    { sortOrder: 20 }),
  item('REJECTION_REASONS', 'RR-003', 'المجموع أقل من المطلوب',    { sortOrder: 30 }),
  item('REJECTION_REASONS', 'RR-004', 'المؤهل لا يطابق',           { sortOrder: 40 }),
  item('REJECTION_REASONS', 'RR-005', 'الطول أقل من المطلوب',      { sortOrder: 50 }),
  item('REJECTION_REASONS', 'RR-006', 'الحالة الاجتماعية غير مطابقة', { sortOrder: 60 }),
  item('REJECTION_REASONS', 'RR-007', 'لم يجتز الكشف الطبي',        { sortOrder: 70 }),
  item('REJECTION_REASONS', 'RR-008', 'لم يجتز الكشف الرياضي',     { sortOrder: 80 }),
  item('REJECTION_REASONS', 'RR-009', 'لم يجتز لجنة القبول',        { sortOrder: 90 }),
  item('REJECTION_REASONS', 'RR-010', 'تحريات غير مرضية',           { sortOrder: 100 }),
  item('REJECTION_REASONS', 'RR-011', 'انسحاب من المتقدم',           { sortOrder: 110 }),
  item('REJECTION_REASONS', 'RR-012', 'تخلّف عن اختبار',             { sortOrder: 120 }),
];

const notificationDepartmentsItems: LookupItem[] = [
  item('NOTIFICATION_DEPARTMENTS', 'admissions',     'إدارة القبول',     { sortOrder: 10 }),
  item('NOTIFICATION_DEPARTMENTS', 'investigations', 'إدارة التحريات',   { sortOrder: 20 }),
  item('NOTIFICATION_DEPARTMENTS', 'medical',        'القومسيون الطبي',  { sortOrder: 30 }),
  item('NOTIFICATION_DEPARTMENTS', 'exams',          'إدارة الاختبارات', { sortOrder: 40 }),
  item('NOTIFICATION_DEPARTMENTS', 'finance',        'الإدارة المالية',  { sortOrder: 50 }),
  item('NOTIFICATION_DEPARTMENTS', 'it',             'إدارة التكنولوجيا', { sortOrder: 60 }),
];

const applicantSectionsItems: LookupItem[] = [
  item('APPLICANT_SECTIONS', 'scientific',         'علمي',          { sortOrder: 10 }),
  item('APPLICANT_SECTIONS', 'scientific_math',    'علمي رياضة',    { sortOrder: 20 }),
  item('APPLICANT_SECTIONS', 'scientific_science', 'علمي علوم',     { sortOrder: 30 }),
  item('APPLICANT_SECTIONS', 'literary',           'أدبي',           { sortOrder: 40 }),
  item('APPLICANT_SECTIONS', 'azhar_scientific',   'أزهر علمي',     { sortOrder: 50 }),
  item('APPLICANT_SECTIONS', 'azhar_literary',     'أزهر أدبي',     { sortOrder: 60 }),
];

const nationalIdMissingReasonsItems: LookupItem[] = [
  item('NATIONAL_ID_MISSING_REASONS', 'NMR-001', 'لم يبلغ سن استخراج البطاقة', { sortOrder: 10 }),
  item('NATIONAL_ID_MISSING_REASONS', 'NMR-002', 'البطاقة قيد الإصدار',         { sortOrder: 20 }),
  item('NATIONAL_ID_MISSING_REASONS', 'NMR-003', 'البطاقة مفقودة',             { sortOrder: 30 }),
  item('NATIONAL_ID_MISSING_REASONS', 'NMR-004', 'البطاقة تالفة',              { sortOrder: 40 }),
  item('NATIONAL_ID_MISSING_REASONS', 'NMR-005', 'غير مصري الجنسية',           { sortOrder: 50 }),
  item('NATIONAL_ID_MISSING_REASONS', 'NMR-006', 'أخرى',                       { sortOrder: 60 }),
];

const nationalitiesItems: LookupItem[] = [
  item('NATIONALITIES', 'NAT-001', 'مصري',      { sortOrder: 10 }),
  item('NATIONALITIES', 'NAT-002', 'سعودي',     { sortOrder: 20 }),
  item('NATIONALITIES', 'NAT-003', 'إماراتي',   { sortOrder: 30 }),
  item('NATIONALITIES', 'NAT-004', 'كويتي',     { sortOrder: 40 }),
  item('NATIONALITIES', 'NAT-005', 'قطري',       { sortOrder: 50 }),
  item('NATIONALITIES', 'NAT-006', 'بحريني',    { sortOrder: 60 }),
  item('NATIONALITIES', 'NAT-007', 'عماني',     { sortOrder: 70 }),
  item('NATIONALITIES', 'NAT-008', 'أردني',     { sortOrder: 80 }),
  item('NATIONALITIES', 'NAT-009', 'فلسطيني',   { sortOrder: 90 }),
  item('NATIONALITIES', 'NAT-010', 'سوري',       { sortOrder: 100 }),
  item('NATIONALITIES', 'NAT-011', 'لبناني',    { sortOrder: 110 }),
  item('NATIONALITIES', 'NAT-012', 'عراقي',     { sortOrder: 120 }),
  item('NATIONALITIES', 'NAT-013', 'ليبي',       { sortOrder: 130 }),
  item('NATIONALITIES', 'NAT-014', 'سوداني',    { sortOrder: 140 }),
];

const caseTypesItems: LookupItem[] = [
  item('CASE_TYPES', 'CS-001', 'قضية جنحة',              { sortOrder: 10, metadata: { severity: 'low',    blocksApplication: false } }),
  item('CASE_TYPES', 'CS-002', 'قضية مدنية',             { sortOrder: 20, metadata: { severity: 'low',    blocksApplication: false } }),
  item('CASE_TYPES', 'CS-003', 'قضية أحوال شخصية',        { sortOrder: 30, metadata: { severity: 'low',    blocksApplication: false } }),
  item('CASE_TYPES', 'CS-004', 'قضية مالية',              { sortOrder: 40, metadata: { severity: 'medium', blocksApplication: false } }),
  item('CASE_TYPES', 'CS-005', 'قضية مخدرات (متهم)',     { sortOrder: 50, metadata: { severity: 'high',   blocksApplication: true  } }),
  item('CASE_TYPES', 'CS-006', 'قضية أمن دولة',           { sortOrder: 60, metadata: { severity: 'high',   blocksApplication: true  } }),
  item('CASE_TYPES', 'CS-007', 'قضية إرهاب',             { sortOrder: 70, metadata: { severity: 'high',   blocksApplication: true  } }),
  item('CASE_TYPES', 'CS-008', 'قضية فساد إداري',         { sortOrder: 80, metadata: { severity: 'high',   blocksApplication: true  } }),
  item('CASE_TYPES', 'CS-009', 'مخالفة مرورية',           { sortOrder: 90, metadata: { severity: 'low',    blocksApplication: false } }),
  item('CASE_TYPES', 'CS-010', 'قضية عمالية',             { sortOrder: 100, metadata: { severity: 'medium', blocksApplication: false } }),
];

/* ─── Aggregate ──────────────────────────────────────────────────────── */

export const LOOKUP_ITEMS: LookupItem[] = [
  ...relationshipCategoryItems,
  ...testsItems,
  ...testModelsItems,
  ...specializationsItems,
  ...universitiesItems,
  ...facultiesItems,
  ...applicantCategoriesItems,
  ...committeesItems,
  ...academicGradesItems,
  ...educationalEntityRankingItems,
  ...countriesItems,
  ...governoratesItems,
  ...policeDepartmentsItems,
  ...jobsItems,
  ...qualificationsItems,
  ...admissionPeriodsItems,
  ...applicantNetworkItems,
  ...schoolLanguageItems,
  ...foreignApplicantsItems,
  ...educationLevelsItems,
  // Extensions
  ...educationTypesItems,
  ...maritalStatusesItems,
  ...specialtiesItems,
  ...specialtyTypesItems,
  ...degreeTypesItems,
  ...examTypesItems,
  ...examGroupsItems,
  ...committeeTypesItems,
  ...rejectionReasonsItems,
  ...notificationDepartmentsItems,
  ...applicantSectionsItems,
  ...nationalIdMissingReasonsItems,
  ...nationalitiesItems,
  ...caseTypesItems,
];

/* ─── Mappings ───────────────────────────────────────────────────────── */

export const LOOKUP_MAPPINGS: LookupMappings = {
  /* Which specializations are open to which applicant category. */
  categorySpecializations: [
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-001'), targetId: id('SPECIALIZATIONS', 'SPC-001') },
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-001'), targetId: id('SPECIALIZATIONS', 'SPC-002') },
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-007'), targetId: id('SPECIALIZATIONS', 'SPC-009') },
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-008'), targetId: id('SPECIALIZATIONS', 'SPC-004') },
  ],
  /* Which committees process which applicant category. */
  categoryCommittees: [
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-001'), targetId: id('COMMITTEES', 'COM-001') },
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-001'), targetId: id('COMMITTEES', 'COM-005') },
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-001'), targetId: id('COMMITTEES', 'COM-006') },
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-002'), targetId: id('COMMITTEES', 'COM-001') },
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-006'), targetId: id('COMMITTEES', 'COM-006') },
  ],
  /* Which tests run for which applicant category. */
  categoryTests: [
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-001'), targetId: id('TESTS', 'TEST-101') },
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-001'), targetId: id('TESTS', 'TEST-102') },
    { categoryId: id('APPLICANT_CATEGORIES', 'CAT-006'), targetId: id('TESTS', 'TEST-301') },
  ],
  /* Which categories are open within which admission period. */
  periodCategories: [
    { categoryId: id('ADMISSION_PERIODS', 'AP-001'), targetId: id('APPLICANT_CATEGORIES', 'CAT-001') },
    { categoryId: id('ADMISSION_PERIODS', 'AP-001'), targetId: id('APPLICANT_CATEGORIES', 'CAT-002') },
    { categoryId: id('ADMISSION_PERIODS', 'AP-002'), targetId: id('APPLICANT_CATEGORIES', 'CAT-001') },
  ],
};
