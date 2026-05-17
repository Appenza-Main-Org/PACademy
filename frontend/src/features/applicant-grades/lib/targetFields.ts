/**
 * Target-field registry for the v2 import wizard's Step 3 mapping UI.
 *
 * Every destination column the wizard writes to the grades table lives
 * here. Each entry carries:
 *   • `key`        — discriminating identifier (`TargetField` union).
 *   • `labelAr`    — Arabic label shown in the mapping list.
 *   • `required`   — whether Step 3's "متابعة" can advance without a pick.
 *   • `synonyms`   — list of source-column header strings (lowercased,
 *                    diacritic-stripped) that auto-mapping will treat as
 *                    matches for this field.
 *
 * The synonyms include both Ministry export schemas (`general` →
 * `seating_no`/`national_no`/…, `azhar` → `StSeatNo`/`StudenName`/…) and
 * the user-facing template headers (`الرقم القومي`, `الاسم باللغة العربية`,
 * …) so a downloaded → filled → uploaded template round-trips through
 * Step 3 without a single manual pick.
 */

export type TargetField =
  | 'nationalId'
  | 'seatingNumber'
  | 'nameAr'
  | 'gender'
  | 'track'
  | 'graduationYear'
  | 'totalGrade'
  | 'maxGrade'
  | 'schoolCategory';

export interface TargetFieldDescriptor {
  key: TargetField;
  labelAr: string;
  required: boolean;
  synonyms: readonly string[];
}

/** Strip Arabic diacritics + alef variants for synonym matching. */
function normalize(s: string): string {
  return s
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[‎‏‎‏]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

export const TARGET_FIELDS: readonly TargetFieldDescriptor[] = [
  {
    key: 'nationalId',
    labelAr: 'الرقم القومي',
    required: true,
    synonyms: [
      'الرقم القومي',
      'الرقم القومى',
      'رقم قومي',
      'national_no',
      'national_code',
      'nationalid',
      'national id',
      'nid',
      'rqm_qwmy',
    ],
  },
  {
    key: 'seatingNumber',
    labelAr: 'رقم الجلوس',
    required: false,
    synonyms: [
      'رقم الجلوس',
      'رقم جلوس',
      'seating_no',
      'seating_number',
      'seat_no',
      'seat',
      'stseatno',
      'rqm_glws',
    ],
  },
  {
    key: 'nameAr',
    labelAr: 'الاسم باللغة العربية',
    required: true,
    synonyms: [
      'الاسم باللغه العربيه',
      'الاسم باللغة العربية',
      'الاسم العربي',
      'الاسم',
      'arabic_name',
      'name_ar',
      'name',
      'studenname',
      'student_name',
      'full_name',
    ],
  },
  {
    key: 'gender',
    labelAr: 'النوع',
    required: false,
    synonyms: [
      'النوع',
      'الجنس',
      'gender',
      'sex',
      'sex_name',
      'sex_desc',
    ],
  },
  {
    key: 'track',
    labelAr: 'الشعبة',
    required: false,
    synonyms: [
      'الشعبه',
      'الشعبة',
      'القسم',
      'branch',
      'branch_desc_new',
      'branch_desc',
      'devisionname',
      'division',
      'track',
    ],
  },
  {
    key: 'graduationYear',
    labelAr: 'سنة التخرج',
    required: false,
    synonyms: [
      'سنه التخرج',
      'سنة التخرج',
      'graduation_year',
      'grad_year',
      'year',
    ],
  },
  {
    key: 'totalGrade',
    labelAr: 'المجموع الكلي',
    required: true,
    synonyms: [
      'المجموع الكلي',
      'المجموع',
      'الدرجه الكليه',
      'الدرجة الكلية',
      'total',
      'total2',
      'total_degree',
      'total_grade',
      'grade',
    ],
  },
  {
    key: 'maxGrade',
    labelAr: 'الدرجة العظمى',
    required: false,
    synonyms: [
      'الدرجه العظمى',
      'الدرجة العظمى',
      'الحد الاقصى',
      'max_grade',
      'max_degree',
      'max',
    ],
  },
  {
    key: 'schoolCategory',
    labelAr: 'فئة المدرسة',
    required: false,
    synonyms: [
      'فئة المدرسة',
      'فئه المدرسه',
      'نوع المدرسة',
      'نوع المدرسه',
      'school_category',
      'school_type',
      'school_kind',
    ],
  },
];

const SYNONYM_LOOKUP = new Map<string, TargetField>();
for (const d of TARGET_FIELDS) {
  for (const syn of d.synonyms) SYNONYM_LOOKUP.set(normalize(syn), d.key);
}

/**
 * Fuzzy-map a list of source column names to target fields.
 *
 * Returns a partial map keyed by every `TargetField`; values are the
 * source-column header that auto-matched, or `null` for unmapped fields.
 * Each source column is consumed at most once — the first target that
 * claims it wins (in declaration order).
 */
export function autoMapColumns(
  sourceColumns: readonly string[],
): Record<TargetField, string | null> {
  const out: Record<TargetField, string | null> = {
    nationalId: null,
    seatingNumber: null,
    nameAr: null,
    gender: null,
    track: null,
    graduationYear: null,
    totalGrade: null,
    maxGrade: null,
    schoolCategory: null,
  };
  const claimed = new Set<string>();
  for (const col of sourceColumns) {
    const normCol = normalize(col);
    const target = SYNONYM_LOOKUP.get(normCol);
    if (target && !out[target] && !claimed.has(col)) {
      out[target] = col;
      claimed.add(col);
    }
  }
  return out;
}

/** Returns the list of required `TargetField`s that have no source mapped. */
export function unmappedRequiredFields(
  mapping: Record<TargetField, string | null>,
): TargetField[] {
  return TARGET_FIELDS.filter((d) => d.required && !mapping[d.key]).map((d) => d.key);
}
