/**
 * Shared family-data types + sessionStorage bridge.
 *
 * `Stage7FamilyPage` (data entry) and `Stage7ReviewFamilyPage` (summary
 * + اعتماد) live on two adjacent wizard routes. Rather than wire a full
 * Zustand slice for this transient blob, the entry page snapshots its
 * state to sessionStorage on continue, and the review page reads it
 * back. SessionStorage keeps it scoped to the tab and resilient across
 * reloads, but doesn't leak across sessions.
 */

import { analyseNationalId } from '@/shared/lib/national-id';

export type RelativeKind =
  | 'brothers'
  | 'sisters'
  | 'paternal_uncles'
  | 'paternal_aunts'
  | 'maternal_aunts'
  | 'maternal_uncles';

export const RELATIVE_LABEL: Record<RelativeKind, { plural: string; singular: string }> = {
  brothers: { plural: 'الإخوة', singular: 'الأخ' },
  sisters: { plural: 'الأخوات', singular: 'الأخت' },
  paternal_uncles: { plural: 'الأعمام', singular: 'العم' },
  paternal_aunts: { plural: 'العمات', singular: 'العمة' },
  maternal_aunts: { plural: 'الخالات', singular: 'الخالة' },
  maternal_uncles: { plural: 'الأخوال', singular: 'الخال' },
};

export const PROFESSION_OPTIONS = [
  { value: '', label: '— اختر —' },
  { value: 'police_officer', label: 'ضابط شرطة' },
  { value: 'army_officer', label: 'ضابط جيش' },
  { value: 'doctor', label: 'طبيب' },
  { value: 'engineer', label: 'مهندس' },
  { value: 'teacher', label: 'معلّم' },
  { value: 'lawyer', label: 'محامي' },
  { value: 'merchant', label: 'تاجر' },
  { value: 'gov_employee', label: 'موظف حكومي' },
  { value: 'private_employee', label: 'موظف قطاع خاص' },
  { value: 'retired', label: 'متقاعد' },
  { value: 'housewife', label: 'ربة منزل' },
  { value: 'other', label: 'أخرى' },
] as const;

export const HOUSEWIFE_PROFESSION = 'housewife';
export const DUPLICATE_FAMILY_NATIONAL_ID_MESSAGE = 'الرقم القومي مُستخدم بالفعل لأحد أفراد الأسرة.';
export const MEMBERSHIP_PROFESSIONS = new Set(['police_officer', 'army_officer']);

export type FamilyMemberGender = 'male' | 'female';

export function genderByRelativeKind(kind: RelativeKind): FamilyMemberGender {
  return kind === 'brothers' || kind === 'paternal_uncles' || kind === 'maternal_uncles'
    ? 'male'
    : 'female';
}

export function professionLabel(code: string): string {
  return PROFESSION_OPTIONS.find((o) => o.value === code)?.label ?? '—';
}

export interface FamilyMemberForm {
  /** Split per client direction 2026-05-21 — applicants enter the
   *  Arabic name in three parts (first / father's / grandfather's)
   *  instead of a single field. */
  firstName: string;
  secondName: string;
  thirdName: string;
  nationalId: string;
  nidUnavailable: boolean;
  nidUnavailableReason: '' | 'fallen_record' | 'born_abroad';
  shuhra?: string;
  religion: 'مسلم' | 'مسيحي';
  dateOfBirth: string;
  birthGovernorate: string;
  birthDistrict: string;
  deceased: boolean;
  residenceGovernorate: string;
  residenceDistrict: string;
  residenceDetail: string;
  profession: string;
  seniorityNumber?: string;
  qualification: string;
  qualificationDetail: string;
  professionDetail: string;
}

export const EMPTY_MEMBER: FamilyMemberForm = {
  firstName: '',
  secondName: '',
  thirdName: '',
  nationalId: '',
  nidUnavailable: false,
  nidUnavailableReason: '',
  shuhra: '',
  religion: 'مسلم',
  dateOfBirth: '',
  birthGovernorate: '',
  birthDistrict: '',
  deceased: false,
  residenceGovernorate: '',
  residenceDistrict: '',
  residenceDetail: '',
  profession: '',
  seniorityNumber: '',
  qualification: '',
  qualificationDetail: '',
  professionDetail: '',
};

export function isBirthLocalityRequired(
  member: Pick<FamilyMemberForm, 'nidUnavailable' | 'nidUnavailableReason'>,
): boolean {
  return !(member.nidUnavailable && member.nidUnavailableReason === 'born_abroad');
}

export function sanitizeFamilyMemberForBirthplace<T extends FamilyMemberForm>(member: T): T {
  if (isBirthLocalityRequired(member)) return member;
  return {
    ...member,
    birthGovernorate: '',
    birthDistrict: '',
  };
}

export interface GrandparentsForm {
  paternalGrandfather: FamilyMemberForm;
  paternalGrandmother: FamilyMemberForm;
  maternalGrandfather: FamilyMemberForm;
  maternalGrandmother: FamilyMemberForm;
}

export const GRANDPARENT_GENDER: Record<keyof GrandparentsForm, FamilyMemberGender> = {
  paternalGrandfather: 'male',
  paternalGrandmother: 'female',
  maternalGrandfather: 'male',
  maternalGrandmother: 'female',
};

export interface GuardianForm {
  firstName: string;
  secondName: string;
  thirdName: string;
  nationalId: string;
  profession: string;
  seniorityNumber?: string;
  qualification: string;
  qualificationDetail: string;
  professionDetail: string;
  workplaceDetail: string;
}

export const EMPTY_GUARDIAN: GuardianForm = {
  firstName: '',
  secondName: '',
  thirdName: '',
  nationalId: '',
  profession: '',
  seniorityNumber: '',
  qualification: '',
  qualificationDetail: '',
  professionDetail: '',
  workplaceDetail: '',
};

export interface FamilyDataSnapshot {
  father: FamilyMemberForm;
  mother: FamilyMemberForm;
  fatherWives: FamilyMemberForm[];
  motherHusbands: FamilyMemberForm[];
  grandparents: GrandparentsForm;
  relatives: Record<RelativeKind, FamilyMemberForm[]>;
  guardian: GuardianForm;
  savedFather: boolean;
  savedMother: boolean;
  savedFatherWives: boolean[];
  savedMotherHusbands: boolean[];
  savedGrandparents: Record<keyof GrandparentsForm, boolean>;
  savedRelatives: Record<RelativeKind, boolean[]>;
  savedGuardian: boolean;
  hasFatherWives: boolean;
  hasMotherHusbands: boolean;
}

const STORAGE_KEY = 'pa-applicant-family-data';

export function saveFamilySnapshot(snapshot: FamilyDataSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* sessionStorage can fail in private-browsing or quota-exceeded
     * scenarios — swallowing keeps the wizard navigable, the review
     * page falls back to its empty state. */
  }
}

export function loadFamilySnapshot(): FamilyDataSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FamilyDataSnapshot;
  } catch {
    return null;
  }
}

export function clearFamilySnapshot(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort cleanup */
  }
}

/**
 * Join the three Arabic name parts into the canonical display form.
 * Trims each part, drops empties, returns "—" when nothing is filled
 * so downstream rendering doesn't have to handle the blank case.
 */
export function formatMemberName(m: {
  firstName: string;
  secondName: string;
  thirdName: string;
}): string {
  const joined = [m.firstName, m.secondName, m.thirdName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
  return joined.length > 0 ? joined : '—';
}

export interface FamilyViewRow {
  serial: number;
  name: string;
  relation: string;
  profession: string;
  saved: boolean;
}

export function buildFamilyRows(s: FamilyDataSnapshot): readonly FamilyViewRow[] {
  const rows: FamilyViewRow[] = [];
  let n = 1;
  rows.push({
    serial: n++,
    name: formatMemberName(s.father),
    relation: 'الأب',
    profession: professionLabel(s.father.profession),
    saved: s.savedFather,
  });
  s.fatherWives.forEach((w, i) => {
    rows.push({
      serial: n++,
      name: formatMemberName(w),
      relation: `زوجة الأب ${i + 1}`,
      profession: professionLabel(w.profession),
      saved: s.savedFatherWives[i] === true,
    });
  });
  rows.push({
    serial: n++,
    name: formatMemberName(s.mother),
    relation: 'الأم',
    profession: professionLabel(s.mother.profession),
    saved: s.savedMother,
  });
  s.motherHusbands.forEach((h, i) => {
    rows.push({
      serial: n++,
      name: formatMemberName(h),
      relation: `زوج الأم ${i + 1}`,
      profession: professionLabel(h.profession),
      saved: s.savedMotherHusbands[i] === true,
    });
  });
  rows.push({
    serial: n++,
    name: formatMemberName(s.grandparents.paternalGrandfather),
    relation: 'الجد لأب',
    profession: professionLabel(s.grandparents.paternalGrandfather.profession),
    saved: s.savedGrandparents.paternalGrandfather,
  });
  rows.push({
    serial: n++,
    name: formatMemberName(s.grandparents.paternalGrandmother),
    relation: 'الجدة لأب',
    profession: professionLabel(s.grandparents.paternalGrandmother.profession),
    saved: s.savedGrandparents.paternalGrandmother,
  });
  rows.push({
    serial: n++,
    name: formatMemberName(s.grandparents.maternalGrandfather),
    relation: 'الجد لأم',
    profession: professionLabel(s.grandparents.maternalGrandfather.profession),
    saved: s.savedGrandparents.maternalGrandfather,
  });
  rows.push({
    serial: n++,
    name: formatMemberName(s.grandparents.maternalGrandmother),
    relation: 'الجدة لأم',
    profession: professionLabel(s.grandparents.maternalGrandmother.profession),
    saved: s.savedGrandparents.maternalGrandmother,
  });
  (Object.keys(RELATIVE_LABEL) as RelativeKind[]).forEach((kind) => {
    s.relatives[kind].forEach((m, i) => {
      rows.push({
        serial: n++,
        name: formatMemberName(m),
        relation: `${RELATIVE_LABEL[kind].singular} ${i + 1}`,
        profession: professionLabel(m.profession),
        saved: s.savedRelatives[kind][i] === true,
      });
    });
  });
  rows.push({
    serial: n++,
    name: formatMemberName(s.guardian),
    relation: 'ولي الأمر',
    profession: professionLabel(s.guardian.profession),
    saved: s.savedGuardian,
  });
  return rows;
}

function isFamilyMemberNationalIdOk(
  member: Pick<FamilyMemberForm, 'nationalId' | 'nidUnavailable' | 'nidUnavailableReason'>,
  expectedGender?: FamilyMemberGender,
): boolean {
  if (member.nidUnavailable) return member.nidUnavailableReason.length > 0;
  const analysis = analyseNationalId(member.nationalId);
  if (!analysis.valid) return false;
  return expectedGender ? analysis.gender === expectedGender : true;
}

/**
 * Field-level completeness for one family member — the single source of
 * truth shared by the entry page's section indicators / progress bar and
 * the اعتماد gate below, so the two can never disagree. Mirrors the
 * required-field rules MemberFormCard enforces at save time.
 */
export function isFamilyMemberComplete(
  m: FamilyMemberForm,
  expectedGender?: FamilyMemberGender,
  opts: { professionDetailOptional?: boolean } = {},
): boolean {
  const birthLocalityOk =
    !isBirthLocalityRequired(m) ||
    (m.birthGovernorate.length > 0 && m.birthDistrict.length > 0);
  const professionDetailOk =
    opts.professionDetailOptional === true || (m.professionDetail ?? '').trim().length > 0;
  return (
    m.firstName.length >= 2 &&
    isFamilyMemberNationalIdOk(m, expectedGender) &&
    m.dateOfBirth.length > 0 &&
    birthLocalityOk &&
    m.profession.length > 0 &&
    m.qualification.length > 0 &&
    professionDetailOk &&
    (m.qualificationDetail ?? '').trim().length > 0 &&
    (!MEMBERSHIP_PROFESSIONS.has(m.profession) || (m.seniorityNumber ?? '').length > 0) &&
    m.residenceGovernorate.length > 0 &&
    m.residenceDistrict.length > 0 &&
    m.residenceDetail.length >= 5
  );
}

/** Mother is the one member whose وصف تفصيلي للوظيفة is waived for «ربة منزل». */
export function isMotherComplete(m: FamilyMemberForm): boolean {
  return isFamilyMemberComplete(m, 'female', {
    professionDetailOptional: m.profession === HOUSEWIFE_PROFESSION,
  });
}

export function isGuardianComplete(g: GuardianForm): boolean {
  return (
    g.firstName.trim().length >= 2 &&
    analyseNationalId(g.nationalId ?? '').valid &&
    g.profession.length > 0 &&
    g.qualification.length > 0
  );
}

/** Same gate as the entry page used for the in-tab "اعتماد" button. */
export function canApproveFamilySnapshot(s: FamilyDataSnapshot): boolean {
  const fatherOk = s.savedFather && isFamilyMemberComplete(s.father, 'male');
  const motherOk = s.savedMother && isMotherComplete(s.mother);
  const grandparentsOk = (Object.keys(GRANDPARENT_GENDER) as (keyof GrandparentsForm)[]).every(
    (key) =>
      s.savedGrandparents[key] &&
      isFamilyMemberComplete(s.grandparents[key], GRANDPARENT_GENDER[key]),
  );
  const fatherWivesOk =
    !s.hasFatherWives ||
    (s.fatherWives.length > 0 &&
      s.fatherWives.every(
        (m, i) => s.savedFatherWives[i] === true && isFamilyMemberComplete(m, 'female'),
      ));
  const motherHusbandsOk =
    !s.hasMotherHusbands ||
    (s.motherHusbands.length > 0 &&
      s.motherHusbands.every(
        (m, i) => s.savedMotherHusbands[i] === true && isFamilyMemberComplete(m, 'male'),
      ));
  const relativesOk = (Object.keys(s.relatives) as RelativeKind[]).every((kind) =>
    s.relatives[kind].every(
      (m, i) =>
        s.savedRelatives[kind][i] === true &&
        isFamilyMemberComplete(m, genderByRelativeKind(kind)),
    ),
  );
  const guardianOk = s.savedGuardian && isGuardianComplete(s.guardian);
  return (
    fatherOk &&
    motherOk &&
    grandparentsOk &&
    !hasDuplicateFamilyNationalId(s) &&
    fatherWivesOk &&
    motherHusbandsOk &&
    relativesOk &&
    guardianOk
  );
}

export function hasDuplicateFamilyNationalId(snapshot: FamilyDataSnapshot): boolean {
  const seen = new Set<string>();
  for (const nationalId of familyNationalIds(snapshot)) {
    if (seen.has(nationalId)) return true;
    seen.add(nationalId);
  }
  return false;
}

function familyNationalIds(snapshot: FamilyDataSnapshot): string[] {
  return [
    ...familyMembersWithNationalIds(snapshot).map((member) => member.nationalId.trim()),
    snapshot.guardian.nationalId?.trim() ?? '',
  ].filter((nationalId) => nationalId.length > 0);
}

function familyMembersWithNationalIds(snapshot: FamilyDataSnapshot): FamilyMemberForm[] {
  return [
    snapshot.father,
    snapshot.mother,
    ...snapshot.fatherWives,
    ...snapshot.motherHusbands,
    snapshot.grandparents.paternalGrandfather,
    snapshot.grandparents.paternalGrandmother,
    snapshot.grandparents.maternalGrandfather,
    snapshot.grandparents.maternalGrandmother,
    ...(Object.keys(snapshot.relatives) as RelativeKind[]).flatMap((kind) => snapshot.relatives[kind]),
  ].filter((member) => !member.nidUnavailable);
}
