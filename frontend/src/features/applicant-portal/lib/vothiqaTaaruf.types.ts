/**
 * وثيقة تعارف (Introduction Document) — type contract for Case 1 (قسم عام).
 *
 * Mirrors the 31 forms (نموذج) in the supplied PDF, grouped into 7 logical
 * accordion sections for the on-screen entry experience. The print layout
 * walks the full 31-form sequence verbatim.
 *
 * Field validation is intentionally permissive at the type level — each
 * field is a plain `string` so partial-save / resume works. Group-level
 * gates (the "no skip without «لا يوجد»" rule) live in the page, not in
 * the schema.
 */

/* ────────────────────────────────────────────────────────────────────
 * Atomic records
 * ──────────────────────────────────────────────────────────────────── */

/** نموذج 1 — بيانات الطالب الشخصية (page 2 of the PDF). */
export interface StudentPersonalRecord {
  fullName: string;
  fileNumber: string;
  shuhraName: string;
  committee: string;
  dateOfBirth: string;
  nationality: string;
  governorate: string;
  birthPlace: string;
  religion: string;
  nationalId: string;
  qualificationOrTrack: string;
  qualificationYear: string;
  totalGrades: string;
  gradesPercent: string;
  homePhone: string;
  mobile: string;
  maritalStatus: 'single' | 'married' | 'divorced' | '';
  address: string;
}

/** نموذج 2 — بيانات والد الطالب + زوجته الحالية (غير الأم). */
export interface FatherRecord {
  fullName: string;
  shuhraName: string;
  dateOfBirth: string;
  birthPlace: string;
  qualification: string;
  profession: string;
  /** Required when profession is `police_officer` or `army_officer`
   *  (mirrors the Stage 7 family page's seniority gate). */
  seniorityNumber: string;
  workplace: string;
  workNature: string;
  address: string;
  homePhone: string;
  mobile: string;
  nationalId: string;
  deceased: boolean;
  hasCurrentWife: boolean;
  currentWifeCount: string;
  currentWife: SpouseSubRecord;
}

/** Wife/Husband sub-record used inside Father/Mother forms. */
export interface SpouseSubRecord {
  fullName: string;
  dateOfBirth: string;
  nationalId: string;
  qualification: string;
  birthPlace: string;
  profession: string;
  seniorityNumber: string;
  workplace: string;
  workNature: string;
}

/** نموذج 3 — بيانات ولي أمر الطالب (في حالة وفاة الوالد). */
export interface GuardianRecord {
  fullName: string;
  shuhraName: string;
  dateOfBirth: string;
  birthPlace: string;
  qualification: string;
  profession: string;
  seniorityNumber: string;
  workplace: string;
  workNature: string;
  address: string;
  nationality: string;
  governorate: string;
  religion: string;
  nationalId: string;
  mobile: string;
}

/** نموذج 4 — بيانات والدة الطالب + زوجها الحالي (غير الأب). */
export interface MotherRecord {
  fullName: string;
  dateOfBirth: string;
  birthPlace: string;
  nationality: string;
  qualification: string;
  religion: string;
  profession: string;
  seniorityNumber: string;
  workplace: string;
  workNature: string;
  address: string;
  homePhone: string;
  mobile: string;
  nationalId: string;
  deceased: boolean;
  hasCurrentHusband: boolean;
  currentHusbandCount: string;
  currentHusband: SpouseSubRecord;
}

/** Applicant's spouse — the wife (male applicant) or husband (female
 *  applicant), captured only when `personal.maritalStatus === 'married'`
 *  (and optionally for divorced/widowed if the previous spouse is on
 *  record). Mirrors نظام-العامين-الدارسيين نموذج 2 / 4 layout. */
export interface ApplicantSpouseRecord {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  birthPlace: string;
  religion: string;
  qualification: string;
  profession: string;
  /** Required when profession is `police_officer` or `army_officer`. */
  seniorityNumber: string;
  workplace: string;
  workNature: string;
  address: string;
  homePhone: string;
  mobile: string;
  nationalId: string;
}

/** Applicant's child — son or daughter — captured only when married.
 *  Same shape as `AdultRelativeRecord` so the print mirror can reuse
 *  the same row layout. */
export type ApplicantChildRecord = AdultRelativeRecord;

/** Applicant's own family — only filled when marital status is
 *  «married» (or divorced/widowed with a recorded ex-spouse). Single
 *  applicants skip this section entirely. */
export interface ApplicantFamilySection {
  /** Optional 2nd wife for male applicants (PDF: «الزوجة الثانية إن وجدت»). */
  hasSecondSpouse: boolean;
  spouse: ApplicantSpouseRecord;
  secondSpouse: ApplicantSpouseRecord;
  /** Sons — for male applicants this is «أبناء الطالب الذكور»; for
   *  female applicants the same field carries the شرعية sons.  */
  sons: RelativeList<ApplicantChildRecord>;
  daughters: RelativeList<ApplicantChildRecord>;
}

/** نموذج 5 — بيانات مسكن الأسرة. */
export interface HousingRecord {
  housingType: string;
  roomsCount: string;
  residentsCount: string;
}

/** نموذج 6 — بيانات دخل الأسرة. */
export interface IncomeRecord {
  incomeDetails: string;
  totalIncome: string;
}

/** نموذج 7 / 8 / 9 / 10 — grandparents (each shares the same shape). */
export interface GrandparentRecord {
  fullName: string;
  shuhraName: string;
  dateOfBirth: string;
  birthPlace: string;
  governorate: string;
  nationality: string;
  religion: string;
  alive: 'alive' | 'deceased' | '';
  nationalId: string;
  qualification: string;
  profession: string;
  seniorityNumber: string;
  workplace: string;
  workNature: string;
  address: string;
}

/**
 * نموذج 11 / 11.1 / 14 / 14.1 / 17 / 20 / 23 / 26 — siblings / paternal
 * + maternal uncles + aunts. The wide-table form: every row carries an
 * adult relative plus their (single) spouse name + address.
 */
export interface AdultRelativeRecord {
  name: string;
  dateOfBirth: string;
  birthPlace: string;
  qualification: string;
  profession: string;
  seniorityNumber: string;
  workplace: string;
  nationalId: string;
  maritalStatus: string;
  address: string;
  spouseName: string;
  deceased: boolean;
}

/**
 * نموذج 12 / 13 / 15 / 16 / 18 / 19 / 21 / 22 / 24 / 25 / 27 / 28 —
 * children of relatives (cousins, nephews, nieces). Identical fields to
 * AdultRelativeRecord but kept as its own alias for naming clarity.
 */
export type RelativeChildRecord = AdultRelativeRecord;

/** نموذج 29 — relatives working for foreign entities. */
export interface ForeignEmployedRelativeRecord {
  fullNameQuad: string;
  kinship: string;
  dobAndPlace: string;
  professionAndQualification: string;
  foreignEntity: string;
  residence: string;
}

/** نموذج 30 — relatives holding non-Egyptian nationality (to 4th degree). */
export interface NaturalizedRelativeRecord {
  fullNameQuad: string;
  kinship: string;
  dobAndPlace: string;
  professionAndQualification: string;
  nationality: string;
  residence: string;
}

/** نموذج 31 — criminal cases involving the student or their relatives. */
export interface CriminalCaseRecord {
  fullNameQuad: string;
  kinship: string;
  caseNumberAndDescription: string;
  finalDisposition: string;
  executedSentences: string;
}

/* ────────────────────────────────────────────────────────────────────
 * Multi-relative lists: each carries a «لا يوجد» flag so the user can
 * explicitly assert "no member of this relation exists" without leaving
 * the field blank silently.
 * ──────────────────────────────────────────────────────────────────── */

export interface RelativeList<T> {
  none: boolean;
  items: T[];
}

export type AdultRelativeList = RelativeList<AdultRelativeRecord>;
export type RelativeChildList = RelativeList<RelativeChildRecord>;
export type ForeignEmployedList = RelativeList<ForeignEmployedRelativeRecord>;
export type NaturalizedList = RelativeList<NaturalizedRelativeRecord>;
export type CriminalCaseList = RelativeList<CriminalCaseRecord>;

/* ────────────────────────────────────────────────────────────────────
 * Section groups (mirror the 7 accordion panels)
 * ──────────────────────────────────────────────────────────────────── */

export interface PersonalSection {
  cover: { fullName: string; fileNumber: string; admissionYear: string; committee: string; governorate: string };
  /** نموذج 1 */ personal: StudentPersonalRecord;
  /** نموذج 5 */ housing: HousingRecord;
  /** نموذج 6 */ income: IncomeRecord;
}

export interface ParentsSection {
  /** نموذج 2 */ father: FatherRecord;
  /** نموذج 3 */ guardian: GuardianRecord;
  /** نموذج 4 */ mother: MotherRecord;
}

export interface GrandparentsSection {
  /** نموذج 7 */ paternalGrandfather: GrandparentRecord;
  /** نموذج 8 */ paternalGrandmother: GrandparentRecord;
  /** نموذج 9 */ maternalGrandfather: GrandparentRecord;
  /** نموذج 10 */ maternalGrandmother: GrandparentRecord;
}

export interface SiblingsSection {
  /** نموذج 11 */ fullBrothers: AdultRelativeList;
  /** نموذج 11/1 */ halfBrothers: AdultRelativeList;
  /** نموذج 12 */ brothersSons: RelativeChildList;
  /** نموذج 13 */ brothersDaughters: RelativeChildList;
  /** نموذج 14 */ fullSisters: AdultRelativeList;
  /** نموذج 14/1 */ halfSisters: AdultRelativeList;
  /** نموذج 15 */ sistersSons: RelativeChildList;
  /** نموذج 16 */ sistersDaughters: RelativeChildList;
}

export interface PaternalRelativesSection {
  /** نموذج 17 */ paternalUncles: AdultRelativeList;
  /** نموذج 18 */ paternalUnclesSons: RelativeChildList;
  /** نموذج 19 */ paternalUnclesDaughters: RelativeChildList;
  /** نموذج 23 */ paternalAunts: AdultRelativeList;
  /** نموذج 24 */ paternalAuntsSons: RelativeChildList;
  /** نموذج 25 */ paternalAuntsDaughters: RelativeChildList;
}

export interface MaternalRelativesSection {
  /** نموذج 20 */ maternalUncles: AdultRelativeList;
  /** نموذج 21 */ maternalUnclesSons: RelativeChildList;
  /** نموذج 22 */ maternalUnclesDaughters: RelativeChildList;
  /** نموذج 26 */ maternalAunts: AdultRelativeList;
  /** نموذج 27 */ maternalAuntsSons: RelativeChildList;
  /** نموذج 28 */ maternalAuntsDaughters: RelativeChildList;
}

export interface ForeignAndCasesSection {
  /** نموذج 29 */ foreignEmployed: ForeignEmployedList;
  /** نموذج 30 */ naturalized: NaturalizedList;
  /** نموذج 31 */ criminalCases: CriminalCaseList;
}

/* ────────────────────────────────────────────────────────────────────
 * Umbrella document
 * ──────────────────────────────────────────────────────────────────── */

export interface VothiqaTaarufDocument {
  /** Stable identifier — Case 1 (`'general'`), Case 2
   *  (`'specialized_officers'`), Case 3 (`'law_bachelor'`).  All three
   *  share the same document shape; the discriminator drives the
   *  cover-page title + a few sub-labels. */
  section: 'general' | 'specialized_officers' | 'law_bachelor';
  personal: PersonalSection;
  /** Optional — only consumed when `personal.personal.maritalStatus`
   *  is «married» (or divorced/widowed with retained ex-spouse). */
  applicantFamily: ApplicantFamilySection;
  parents: ParentsSection;
  grandparents: GrandparentsSection;
  siblings: SiblingsSection;
  paternalRelatives: PaternalRelativesSection;
  maternalRelatives: MaternalRelativesSection;
  foreignAndCases: ForeignAndCasesSection;
}

/** Section keys in display order — drives accordion + progress strip.
 *  `applicantFamily` sits between «personal» and «parents» so the
 *  applicant captures their own immediate family before the parents
 *  + extended-family sections (matches the new template's نموذج 2/4/12
 *  positioning). */
export const GROUP_KEYS = [
  'personal',
  'applicantFamily',
  'parents',
  'grandparents',
  'siblings',
  'paternalRelatives',
  'maternalRelatives',
  'foreignAndCases',
] as const satisfies ReadonlyArray<keyof Omit<VothiqaTaarufDocument, 'section'>>;

export type GroupKey = (typeof GROUP_KEYS)[number];

export const GROUP_LABELS: Record<GroupKey, string> = {
  personal: 'بيانات الطالب وأسرته',
  applicantFamily: 'الزوج/الزوجة والأبناء (للمتزوج)',
  parents: 'الوالدان وولي الأمر',
  grandparents: 'الأجداد',
  siblings: 'الإخوة وأبناؤهم',
  paternalRelatives: 'عائلة الأب (الأعمام والعمات)',
  maternalRelatives: 'عائلة الأم (الأخوال والخالات)',
  foreignAndCases: 'أقارب بالخارج والقضايا',
};

/* ────────────────────────────────────────────────────────────────────
 * Empty-record factories — every leaf field has a value so React-Hook-Form
 * defaultValues stays uncontrolled-free.
 * ──────────────────────────────────────────────────────────────────── */

export function emptyStudentPersonal(): StudentPersonalRecord {
  return {
    fullName: '', fileNumber: '', shuhraName: '', committee: '', dateOfBirth: '',
    nationality: 'مصرية', governorate: '', birthPlace: '', religion: '', nationalId: '',
    qualificationOrTrack: '', qualificationYear: '', totalGrades: '', gradesPercent: '',
    homePhone: '', mobile: '', maritalStatus: 'single', address: '',
  };
}

export function emptySpouseSub(): SpouseSubRecord {
  return {
    fullName: '', dateOfBirth: '', nationalId: '', qualification: '',
    birthPlace: '', profession: '', seniorityNumber: '', workplace: '', workNature: '',
  };
}

export function emptyFather(): FatherRecord {
  return {
    fullName: '', shuhraName: '', dateOfBirth: '', birthPlace: '',
    qualification: '', profession: '', seniorityNumber: '', workplace: '', workNature: '',
    address: '', homePhone: '', mobile: '', nationalId: '',
    deceased: false, hasCurrentWife: false, currentWifeCount: '0',
    currentWife: emptySpouseSub(),
  };
}

export function emptyMother(): MotherRecord {
  return {
    fullName: '', dateOfBirth: '', birthPlace: '', nationality: 'مصرية',
    qualification: '', religion: '', profession: '', seniorityNumber: '', workplace: '', workNature: '',
    address: '', homePhone: '', mobile: '', nationalId: '',
    deceased: false, hasCurrentHusband: false, currentHusbandCount: '0',
    currentHusband: emptySpouseSub(),
  };
}

export function emptyGuardian(): GuardianRecord {
  return {
    fullName: '', shuhraName: '', dateOfBirth: '', birthPlace: '',
    qualification: '', profession: '', seniorityNumber: '', workplace: '', workNature: '',
    address: '', nationality: 'مصرية', governorate: '', religion: '',
    nationalId: '', mobile: '',
  };
}

export function emptyApplicantSpouse(): ApplicantSpouseRecord {
  return {
    fullName: '', dateOfBirth: '', nationality: 'مصرية', birthPlace: '',
    religion: '', qualification: '', profession: '', seniorityNumber: '',
    workplace: '', workNature: '', address: '', homePhone: '',
    mobile: '', nationalId: '',
  };
}

export function emptyApplicantFamily(): ApplicantFamilySection {
  return {
    hasSecondSpouse: false,
    spouse: emptyApplicantSpouse(),
    secondSpouse: emptyApplicantSpouse(),
    sons: emptyList(),
    daughters: emptyList(),
  };
}

export function emptyHousing(): HousingRecord {
  return { housingType: '', roomsCount: '', residentsCount: '' };
}

export function emptyIncome(): IncomeRecord {
  return { incomeDetails: '', totalIncome: '' };
}

export function emptyGrandparent(): GrandparentRecord {
  return {
    fullName: '', shuhraName: '', dateOfBirth: '', birthPlace: '', governorate: '',
    nationality: 'مصرية', religion: '', alive: '', nationalId: '',
    qualification: '', profession: '', seniorityNumber: '',
    workplace: '', workNature: '', address: '',
  };
}

export function emptyAdultRelative(): AdultRelativeRecord {
  return {
    name: '', dateOfBirth: '', birthPlace: '', qualification: '',
    profession: '', seniorityNumber: '', workplace: '', nationalId: '',
    maritalStatus: '', address: '', spouseName: '', deceased: false,
  };
}

export function emptyForeignEmployed(): ForeignEmployedRelativeRecord {
  return {
    fullNameQuad: '', kinship: '', dobAndPlace: '',
    professionAndQualification: '', foreignEntity: '', residence: '',
  };
}

export function emptyNaturalized(): NaturalizedRelativeRecord {
  return {
    fullNameQuad: '', kinship: '', dobAndPlace: '',
    professionAndQualification: '', nationality: '', residence: '',
  };
}

export function emptyCriminalCase(): CriminalCaseRecord {
  return {
    fullNameQuad: '', kinship: '', caseNumberAndDescription: '',
    finalDisposition: '', executedSentences: '',
  };
}

export function emptyList<T>(): RelativeList<T> {
  return { none: false, items: [] };
}

export function emptyDocument(): VothiqaTaarufDocument {
  return {
    section: 'general',
    personal: {
      cover: { fullName: '', fileNumber: '', admissionYear: '', committee: '', governorate: '' },
      personal: emptyStudentPersonal(),
      housing: emptyHousing(),
      income: emptyIncome(),
    },
    applicantFamily: emptyApplicantFamily(),
    parents: {
      father: emptyFather(),
      guardian: emptyGuardian(),
      mother: emptyMother(),
    },
    grandparents: {
      paternalGrandfather: emptyGrandparent(),
      paternalGrandmother: emptyGrandparent(),
      maternalGrandfather: emptyGrandparent(),
      maternalGrandmother: emptyGrandparent(),
    },
    siblings: {
      fullBrothers: emptyList(), halfBrothers: emptyList(),
      brothersSons: emptyList(), brothersDaughters: emptyList(),
      fullSisters: emptyList(), halfSisters: emptyList(),
      sistersSons: emptyList(), sistersDaughters: emptyList(),
    },
    paternalRelatives: {
      paternalUncles: emptyList(), paternalUnclesSons: emptyList(), paternalUnclesDaughters: emptyList(),
      paternalAunts: emptyList(), paternalAuntsSons: emptyList(), paternalAuntsDaughters: emptyList(),
    },
    maternalRelatives: {
      maternalUncles: emptyList(), maternalUnclesSons: emptyList(), maternalUnclesDaughters: emptyList(),
      maternalAunts: emptyList(), maternalAuntsSons: emptyList(), maternalAuntsDaughters: emptyList(),
    },
    foreignAndCases: {
      foreignEmployed: emptyList(), naturalized: emptyList(), criminalCases: emptyList(),
    },
  };
}
