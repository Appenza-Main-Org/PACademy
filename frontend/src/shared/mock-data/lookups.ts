/**
 * Lookup matrix seed data — Gap I (admin-gaps).
 *
 * Each entry is a list of `LookupRow` rows — initial seed for the
 * platform-wide lookup catalogue. System rows (`isSystem: true`) ship
 * with the platform and cannot be hard-deleted; admin can deactivate
 * them (`isActive: false`) to drop them from pickers.
 *
 * Real backend will replace this with `GET /api/lookups/:key` calls.
 */

import type { LookupKey, LookupRow } from '@/shared/types/domain';

const sys = (key: string, labelAr: string, sortOrder: number, extras: Partial<LookupRow> = {}): LookupRow => ({
  id: `LK-${key}`,
  key,
  labelAr,
  sortOrder,
  isActive: true,
  isSystem: true,
  ...extras,
});

/* Education types — RFP §p.27 + meeting notes
 * (ثانوية عامة، أزهر، تربية رياضية، حقوق، بكالوريوس، ماجستير، دكتوراه، شهادات أجنبية) */
const educationTypes: LookupRow[] = [
  sys('thanaweya_amma', 'ثانوية عامة', 10),
  sys('azhar', 'أزهر', 20),
  sys('sports_education', 'تربية رياضية', 30),
  sys('law', 'حقوق', 40),
  sys('bachelor', 'بكالوريوس', 50),
  sys('master', 'ماجستير', 60),
  sys('phd', 'دكتوراه', 70),
  sys('foreign_certificates', 'شهادات أجنبية', 80),
  sys('ig', 'IG', 81),
  sys('american_diploma', 'الدبلوم الأمريكي', 82),
];

const maritalStatuses: LookupRow[] = [
  sys('single', 'أعزب', 10),
  sys('married', 'متزوج', 20),
  sys('divorced', 'مطلق', 30, { isActive: false }),
  sys('widowed', 'أرمل', 40, { isActive: false }),
];

const universities: LookupRow[] = [
  sys('cairo', 'جامعة القاهرة', 10),
  sys('ain_shams', 'جامعة عين شمس', 20),
  sys('alexandria', 'جامعة الإسكندرية', 30),
  sys('mansoura', 'جامعة المنصورة', 40),
  sys('assiut', 'جامعة أسيوط', 50),
  sys('helwan', 'جامعة حلوان', 60),
  sys('zagazig', 'جامعة الزقازيق', 70),
  sys('police_academy', 'أكاديمية الشرطة', 80),
];

/* Faculties — `parentId` references a university row id. */
const faculties: LookupRow[] = [
  sys('engineering', 'كلية الهندسة', 10, { parentId: 'LK-cairo' }),
  sys('law_cu', 'كلية الحقوق', 20, { parentId: 'LK-cairo' }),
  sys('commerce', 'كلية التجارة', 30, { parentId: 'LK-cairo' }),
  sys('medicine_as', 'كلية الطب', 10, { parentId: 'LK-ain_shams' }),
  sys('engineering_as', 'كلية الهندسة', 20, { parentId: 'LK-ain_shams' }),
  sys('police', 'كلية الشرطة', 10, { parentId: 'LK-police_academy' }),
];

/* Specialty types (handasa, 7asabat, …) — `parentId` references a faculty id. */
const specialtyTypes: LookupRow[] = [
  sys('engineering', 'هندسة', 10, { parentId: 'LK-engineering' }),
  sys('accounting', 'محاسبة', 20, { parentId: 'LK-commerce' }),
  sys('law', 'قانون', 30, { parentId: 'LK-law_cu' }),
  sys('medicine', 'طب', 40, { parentId: 'LK-medicine_as' }),
  sys('computer_science', 'علوم الحاسب', 50, { parentId: 'LK-engineering' }),
  sys('business', 'إدارة الأعمال', 60, { parentId: 'LK-commerce' }),
];

/* Specialties — `parentId` references a faculty id. */
const specialties: LookupRow[] = [
  sys('civil_engineering', 'هندسة مدنية', 10, { parentId: 'LK-engineering' }),
  sys('electrical_engineering', 'هندسة كهربائية', 20, { parentId: 'LK-engineering' }),
  sys('mechanical_engineering', 'هندسة ميكانيكية', 30, { parentId: 'LK-engineering' }),
  sys('financial_accounting', 'محاسبة مالية', 10, { parentId: 'LK-commerce' }),
  sys('cost_accounting', 'محاسبة تكاليف', 20, { parentId: 'LK-commerce' }),
];

const degreeTypes: LookupRow[] = [
  sys('bachelor', 'بكالوريوس', 10),
  sys('master', 'ماجستير', 20),
  sys('phd', 'دكتوراه', 30),
  sys('higher_diploma', 'دبلوم عالٍ', 40),
];

const jobs: LookupRow[] = [
  sys('teacher', 'مدرّس', 10),
  sys('engineer', 'مهندس', 20),
  sys('doctor', 'طبيب', 30),
  sys('lawyer', 'محامٍ', 40),
  sys('accountant', 'محاسب', 50),
  sys('officer', 'ضابط شرطة', 60),
  sys('officer_armed_forces', 'ضابط قوات مسلحة', 70),
  sys('public_employee', 'موظف حكومي', 80),
  sys('private_employee', 'موظف قطاع خاص', 90),
  sys('businessman', 'رجل أعمال', 100),
  sys('housewife', 'ربة منزل', 110),
  sys('retired', 'متقاعد', 120),
];

const examTypes: LookupRow[] = [
  sys('aptitude', 'القدرات', 10),
  sys('height', 'الطول', 20),
  sys('appearance_external', 'السمات الخارجي', 30),
  sys('appearance_internal', 'السمات الداخلي', 40),
  sys('physical', 'الرياضي', 50),
  sys('physical_retake', 'إعادة الرياضي', 60),
  sys('posture', 'الهيئة', 70),
  sys('build', 'القوام', 80),
  sys('build_retake', 'إعادة القوام', 90),
  sys('medical', 'الطبي', 100),
  sys('medical_retake', 'إعادة الطبي', 110),
  sys('psychology', 'الاتزان النفسي', 120),
  sys('medical_advanced', 'الطبي المتقدم', 130),
];

const examGroups: LookupRow[] = [
  sys('preliminary', 'الاختبارات الأولية', 10),
  sys('committees_capacity_traits', 'لجان القدرات والسمات', 20),
  sys('physical_group', 'الاختبارات الرياضية', 30),
  sys('medical_group', 'الاختبارات الطبية', 40),
  sys('psychology_group', 'الاختبارات النفسية', 50),
  sys('faculty_exams', 'اختبارات الكلية', 60),
];

const committeeTypes: LookupRow[] = [
  sys('capacities', 'لجنة القدرات', 10),
  sys('traits', 'لجنة السمات', 20),
  sys('sports', 'لجنة الرياضة', 30),
  sys('interview', 'لجنة المقابلة', 40),
];

const rejectionReasons: LookupRow[] = [
  sys('age_out_of_range', 'السن خارج المسموح به', 10),
  sys('gender_mismatch', 'لا يطابق متطلبات النوع', 20),
  sys('score_below_min', 'المجموع أقل من المطلوب', 30),
  sys('qualification_mismatch', 'المؤهل لا يطابق', 40),
  sys('height_below_min', 'الطول أقل من المطلوب', 50),
  sys('marital_status_mismatch', 'الحالة الاجتماعية غير مطابقة', 60),
  sys('failed_medical', 'لم يجتز الكشف الطبي', 70),
  sys('failed_physical', 'لم يجتز الكشف الرياضي', 80),
  sys('failed_committee', 'لم يجتز لجنة القبول', 90),
  sys('failed_investigation', 'تحريات غير مرضية', 100),
  sys('withdrawal', 'انسحاب من المتقدم', 110),
  sys('absent_from_test', 'تخلّف عن اختبار', 120),
];

const notificationDepartments: LookupRow[] = [
  sys('admissions', 'إدارة القبول', 10),
  sys('investigations', 'إدارة التحريات', 20),
  sys('medical', 'القومسيون الطبي', 30),
  sys('exams', 'إدارة الاختبارات', 40),
  sys('finance', 'الإدارة المالية', 50),
  sys('it', 'إدارة التكنولوجيا', 60),
];

const applicantSections: LookupRow[] = [
  sys('scientific', 'علمي', 10),
  sys('scientific_math', 'علمي رياضة', 20),
  sys('scientific_science', 'علمي علوم', 30),
  sys('literary', 'أدبي', 40),
  sys('azhar_scientific', 'أزهر علمي', 50),
  sys('azhar_literary', 'أزهر أدبي', 60),
];

const nationalIdMissingReasons: LookupRow[] = [
  sys('under_age', 'لم يبلغ سن استخراج البطاقة', 10),
  sys('issuance_in_progress', 'البطاقة قيد الإصدار', 20),
  sys('lost', 'البطاقة مفقودة', 30),
  sys('damaged', 'البطاقة تالفة', 40),
  sys('foreign_national', 'غير مصري الجنسية', 50),
  sys('other', 'أخرى', 90),
];

export const LOOKUP_SEED: Record<LookupKey, LookupRow[]> = {
  educationTypes,
  maritalStatuses,
  universities,
  faculties,
  specialties,
  specialtyTypes,
  degreeTypes,
  jobs,
  examTypes,
  examGroups,
  committeeTypes,
  rejectionReasons,
  notificationDepartments,
  applicantSections,
  nationalIdMissingReasons,
};

/** Arabic tab label for each lookup. */
export const LOOKUP_LABELS: Record<LookupKey, string> = {
  educationTypes: 'فئة المدرسة',
  maritalStatuses: 'الحالة الاجتماعية',
  universities: 'الجامعات',
  faculties: 'الكليات',
  specialties: 'التخصصات الفرعية',
  specialtyTypes: 'أنواع التخصصات',
  degreeTypes: 'أنواع الشهادات',
  jobs: 'الوظائف',
  examTypes: 'أنواع الاختبارات',
  examGroups: 'مجموعات الاختبارات',
  committeeTypes: 'أنواع اللجان',
  rejectionReasons: 'أسباب الرفض',
  notificationDepartments: 'أقسام الإشعارات',
  applicantSections: 'شعبة المتقدمين',
  nationalIdMissingReasons: 'أسباب تعذر وجود رقم قومي',
};

/** Parent lookup key for hierarchical lookups; null when standalone. */
export const LOOKUP_PARENT: Record<LookupKey, LookupKey | null> = {
  educationTypes: null,
  maritalStatuses: null,
  universities: null,
  faculties: 'universities',
  specialties: 'faculties',
  specialtyTypes: 'faculties',
  degreeTypes: null,
  jobs: null,
  examTypes: null,
  examGroups: null,
  committeeTypes: null,
  rejectionReasons: null,
  notificationDepartments: null,
  applicantSections: null,
  nationalIdMissingReasons: null,
};

/** Lookups that exercise the optional `gender` filter on rows. */
export const LOOKUP_HAS_GENDER: ReadonlySet<LookupKey> = new Set<LookupKey>(['specialties']);
