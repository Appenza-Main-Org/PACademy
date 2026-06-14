/**
 * Field-label maps + list column specs for the admin acquaintance-document
 * (وثيقة التعارف) read-only mirror. Kept separate from the renderer so the
 * component stays composition-only — the bulk here is data, not logic.
 *
 * Labels mirror the applicant portal's نموذج sequence; the record/list shapes
 * are the `VothiqaTaaruf*` types re-exported from `@/features/applicant-portal`.
 */

/** One scalar field of a record, rendered as a labelled cell. `format` maps a
 *  raw value (enum code, boolean) to display text. */
export interface FieldSpec {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

const maritalStatus = (value: unknown): string => {
  if (value === 'single') return 'أعزب';
  if (value === 'married') return 'متزوج';
  return String(value ?? '');
};

const aliveStatus = (value: unknown): string => {
  if (value === 'alive') return 'على قيد الحياة';
  if (value === 'deceased') return 'متوفى';
  return String(value ?? '');
};

const yesNo = (value: unknown): string => (value === true ? 'نعم' : value === false ? 'لا' : String(value ?? ''));

/** نموذج 1 — student personal data. */
export const STUDENT_FIELDS: FieldSpec[] = [
  { key: 'fullName', label: 'الاسم رباعي' },
  { key: 'shuhraName', label: 'اسم الشهرة' },
  { key: 'nationalId', label: 'الرقم القومي' },
  { key: 'fileNumber', label: 'رقم الملف' },
  { key: 'committee', label: 'اللجنة' },
  { key: 'dateOfBirth', label: 'تاريخ الميلاد' },
  { key: 'birthPlace', label: 'محل الميلاد' },
  { key: 'governorate', label: 'المحافظة' },
  { key: 'nationality', label: 'الجنسية' },
  { key: 'religion', label: 'الديانة' },
  { key: 'qualificationOrTrack', label: 'المؤهل / الشعبة' },
  { key: 'qualificationYear', label: 'سنة المؤهل' },
  { key: 'totalGrades', label: 'المجموع' },
  { key: 'gradesPercent', label: 'النسبة المئوية' },
  { key: 'maritalStatus', label: 'الحالة الاجتماعية', format: maritalStatus },
  { key: 'homePhone', label: 'هاتف المنزل' },
  { key: 'mobile', label: 'المحمول' },
  { key: 'address', label: 'العنوان' },
];

/** نموذج 5 — housing. */
export const HOUSING_FIELDS: FieldSpec[] = [
  { key: 'housingType', label: 'نوع السكن' },
  { key: 'roomsCount', label: 'عدد الغرف' },
  { key: 'residentsCount', label: 'عدد القاطنين' },
];

/** نموذج 6 — income. */
export const INCOME_FIELDS: FieldSpec[] = [
  { key: 'incomeDetails', label: 'تفاصيل الدخل' },
  { key: 'totalIncome', label: 'إجمالي الدخل' },
];

/** نموذج 2 — father (and the shared currentWife sub-record). */
export const FATHER_FIELDS: FieldSpec[] = [
  { key: 'fullName', label: 'الاسم' },
  { key: 'shuhraName', label: 'اسم الشهرة' },
  { key: 'nationalId', label: 'الرقم القومي' },
  { key: 'dateOfBirth', label: 'تاريخ الميلاد' },
  { key: 'birthPlace', label: 'محل الميلاد' },
  { key: 'qualification', label: 'المؤهل' },
  { key: 'profession', label: 'المهنة' },
  { key: 'seniorityNumber', label: 'رقم الأقدمية' },
  { key: 'workplace', label: 'جهة العمل' },
  { key: 'workNature', label: 'طبيعة العمل' },
  { key: 'homePhone', label: 'هاتف المنزل' },
  { key: 'mobile', label: 'المحمول' },
  { key: 'address', label: 'العنوان' },
  { key: 'deceased', label: 'متوفى', format: yesNo },
];

/** نموذج 4 — mother. */
export const MOTHER_FIELDS: FieldSpec[] = [
  { key: 'fullName', label: 'الاسم' },
  { key: 'nationalId', label: 'الرقم القومي' },
  { key: 'dateOfBirth', label: 'تاريخ الميلاد' },
  { key: 'birthPlace', label: 'محل الميلاد' },
  { key: 'nationality', label: 'الجنسية' },
  { key: 'religion', label: 'الديانة' },
  { key: 'qualification', label: 'المؤهل' },
  { key: 'profession', label: 'المهنة' },
  { key: 'seniorityNumber', label: 'رقم الأقدمية' },
  { key: 'workplace', label: 'جهة العمل' },
  { key: 'workNature', label: 'طبيعة العمل' },
  { key: 'homePhone', label: 'هاتف المنزل' },
  { key: 'mobile', label: 'المحمول' },
  { key: 'address', label: 'العنوان' },
  { key: 'deceased', label: 'متوفاة', format: yesNo },
];

/** نموذج 3 — guardian (when the father is deceased). */
export const GUARDIAN_FIELDS: FieldSpec[] = [
  { key: 'fullName', label: 'الاسم' },
  { key: 'shuhraName', label: 'اسم الشهرة' },
  { key: 'nationalId', label: 'الرقم القومي' },
  { key: 'dateOfBirth', label: 'تاريخ الميلاد' },
  { key: 'birthPlace', label: 'محل الميلاد' },
  { key: 'nationality', label: 'الجنسية' },
  { key: 'governorate', label: 'المحافظة' },
  { key: 'religion', label: 'الديانة' },
  { key: 'qualification', label: 'المؤهل' },
  { key: 'profession', label: 'المهنة' },
  { key: 'seniorityNumber', label: 'رقم الأقدمية' },
  { key: 'workplace', label: 'جهة العمل' },
  { key: 'workNature', label: 'طبيعة العمل' },
  { key: 'mobile', label: 'المحمول' },
  { key: 'address', label: 'العنوان' },
];

/** Shared wife/husband sub-record used inside father / mother. */
export const SPOUSE_SUB_FIELDS: FieldSpec[] = [
  { key: 'fullName', label: 'الاسم' },
  { key: 'nationalId', label: 'الرقم القومي' },
  { key: 'dateOfBirth', label: 'تاريخ الميلاد' },
  { key: 'birthPlace', label: 'محل الميلاد' },
  { key: 'qualification', label: 'المؤهل' },
  { key: 'profession', label: 'المهنة' },
  { key: 'seniorityNumber', label: 'رقم الأقدمية' },
  { key: 'workplace', label: 'جهة العمل' },
  { key: 'workNature', label: 'طبيعة العمل' },
];

/** Applicant's own spouse (when married). */
export const APPLICANT_SPOUSE_FIELDS: FieldSpec[] = [
  { key: 'fullName', label: 'الاسم' },
  { key: 'nationalId', label: 'الرقم القومي' },
  { key: 'dateOfBirth', label: 'تاريخ الميلاد' },
  { key: 'birthPlace', label: 'محل الميلاد' },
  { key: 'nationality', label: 'الجنسية' },
  { key: 'religion', label: 'الديانة' },
  { key: 'qualification', label: 'المؤهل' },
  { key: 'profession', label: 'المهنة' },
  { key: 'seniorityNumber', label: 'رقم الأقدمية' },
  { key: 'workplace', label: 'جهة العمل' },
  { key: 'workNature', label: 'طبيعة العمل' },
  { key: 'homePhone', label: 'هاتف المنزل' },
  { key: 'mobile', label: 'المحمول' },
  { key: 'address', label: 'العنوان' },
];

/** نموذج 7 / 8 / 9 / 10 — grandparents. */
export const GRANDPARENT_FIELDS: FieldSpec[] = [
  { key: 'fullName', label: 'الاسم' },
  { key: 'shuhraName', label: 'اسم الشهرة' },
  { key: 'nationalId', label: 'الرقم القومي' },
  { key: 'dateOfBirth', label: 'تاريخ الميلاد' },
  { key: 'birthPlace', label: 'محل الميلاد' },
  { key: 'governorate', label: 'المحافظة' },
  { key: 'nationality', label: 'الجنسية' },
  { key: 'religion', label: 'الديانة' },
  { key: 'alive', label: 'الحالة', format: aliveStatus },
  { key: 'qualification', label: 'المؤهل' },
  { key: 'profession', label: 'المهنة' },
  { key: 'seniorityNumber', label: 'رقم الأقدمية' },
  { key: 'workplace', label: 'جهة العمل' },
  { key: 'workNature', label: 'طبيعة العمل' },
  { key: 'address', label: 'العنوان' },
];

/** Adult relative table (siblings, uncles, aunts, and their children all share
 *  this shape) — rendered as table columns. */
export const ADULT_RELATIVE_COLUMNS: FieldSpec[] = [
  { key: 'name', label: 'الاسم' },
  { key: 'nationalId', label: 'الرقم القومي' },
  { key: 'dateOfBirth', label: 'تاريخ الميلاد' },
  { key: 'birthPlace', label: 'محل الميلاد' },
  { key: 'qualification', label: 'المؤهل' },
  { key: 'profession', label: 'المهنة' },
  { key: 'seniorityNumber', label: 'رقم الأقدمية' },
  { key: 'workplace', label: 'جهة العمل' },
  { key: 'maritalStatus', label: 'الحالة الاجتماعية' },
  { key: 'spouseName', label: 'اسم الزوج/ة' },
  { key: 'address', label: 'العنوان' },
  { key: 'deceased', label: 'متوفى', format: yesNo },
];

/** نموذج 29 — relatives employed by foreign entities. */
export const FOREIGN_EMPLOYED_COLUMNS: FieldSpec[] = [
  { key: 'fullNameQuad', label: 'الاسم رباعي' },
  { key: 'kinship', label: 'صلة القرابة' },
  { key: 'dobAndPlace', label: 'تاريخ ومحل الميلاد' },
  { key: 'professionAndQualification', label: 'المهنة والمؤهل' },
  { key: 'foreignEntity', label: 'الجهة الأجنبية' },
  { key: 'residence', label: 'محل الإقامة' },
];

/** نموذج 30 — relatives holding non-Egyptian nationality. */
export const NATURALIZED_COLUMNS: FieldSpec[] = [
  { key: 'fullNameQuad', label: 'الاسم رباعي' },
  { key: 'kinship', label: 'صلة القرابة' },
  { key: 'dobAndPlace', label: 'تاريخ ومحل الميلاد' },
  { key: 'professionAndQualification', label: 'المهنة والمؤهل' },
  { key: 'nationality', label: 'الجنسية' },
  { key: 'residence', label: 'محل الإقامة' },
];

/** نموذج 31 — criminal cases. */
export const CRIMINAL_CASE_COLUMNS: FieldSpec[] = [
  { key: 'fullNameQuad', label: 'الاسم رباعي' },
  { key: 'kinship', label: 'صلة القرابة' },
  { key: 'caseNumberAndDescription', label: 'رقم ووصف القضية' },
  { key: 'finalDisposition', label: 'التصرف النهائي' },
  { key: 'executedSentences', label: 'الأحكام المنفذة' },
];

/** Sub-list labels inside the siblings / paternal / maternal sections. */
export const RELATIVE_LIST_LABELS: Record<string, string> = {
  fullBrothers: 'الإخوة الأشقاء',
  halfBrothers: 'الإخوة غير الأشقاء',
  brothersSons: 'أبناء الإخوة',
  brothersDaughters: 'بنات الإخوة',
  fullSisters: 'الأخوات الشقيقات',
  halfSisters: 'الأخوات غير الشقيقات',
  sistersSons: 'أبناء الأخوات',
  sistersDaughters: 'بنات الأخوات',
  paternalUncles: 'الأعمام',
  paternalUnclesSons: 'أبناء الأعمام',
  paternalUnclesDaughters: 'بنات الأعمام',
  paternalAunts: 'العمّات',
  paternalAuntsSons: 'أبناء العمّات',
  paternalAuntsDaughters: 'بنات العمّات',
  maternalUncles: 'الأخوال',
  maternalUnclesSons: 'أبناء الأخوال',
  maternalUnclesDaughters: 'بنات الأخوال',
  maternalAunts: 'الخالات',
  maternalAuntsSons: 'أبناء الخالات',
  maternalAuntsDaughters: 'بنات الخالات',
};

/** Display order for the four grandparent records. */
export const GRANDPARENT_LABELS: Record<string, string> = {
  paternalGrandfather: 'الجد لأب',
  paternalGrandmother: 'الجدة لأب',
  maternalGrandfather: 'الجد لأم',
  maternalGrandmother: 'الجدة لأم',
};

/** Lifecycle status → Arabic label + Badge tone. */
export const ACQUAINTANCE_STATUS_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  open: { label: 'مفتوحة للتعديل', tone: 'warning' },
  closed: { label: 'مغلقة', tone: 'success' },
  not_open: { label: 'لم تُفتح بعد', tone: 'neutral' },
};
