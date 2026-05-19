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

export function professionLabel(code: string): string {
  return PROFESSION_OPTIONS.find((o) => o.value === code)?.label ?? '—';
}

export interface FamilyMemberForm {
  name: string;
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
  name: '',
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

export interface GrandparentsForm {
  paternalGrandfather: FamilyMemberForm;
  paternalGrandmother: FamilyMemberForm;
  maternalGrandfather: FamilyMemberForm;
  maternalGrandmother: FamilyMemberForm;
}

export interface GuardianForm {
  name: string;
  profession: string;
  seniorityNumber?: string;
  qualification: string;
  qualificationDetail: string;
  professionDetail: string;
  workplaceDetail: string;
}

export const EMPTY_GUARDIAN: GuardianForm = {
  name: '',
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
    name: s.father.name || '—',
    relation: 'الأب',
    profession: professionLabel(s.father.profession),
    saved: s.savedFather,
  });
  s.fatherWives.forEach((w, i) => {
    rows.push({
      serial: n++,
      name: w.name || '—',
      relation: `زوجة الأب ${i + 1}`,
      profession: professionLabel(w.profession),
      saved: s.savedFatherWives[i] === true,
    });
  });
  rows.push({
    serial: n++,
    name: s.mother.name || '—',
    relation: 'الأم',
    profession: professionLabel(s.mother.profession),
    saved: s.savedMother,
  });
  s.motherHusbands.forEach((h, i) => {
    rows.push({
      serial: n++,
      name: h.name || '—',
      relation: `زوج الأم ${i + 1}`,
      profession: professionLabel(h.profession),
      saved: s.savedMotherHusbands[i] === true,
    });
  });
  rows.push({
    serial: n++,
    name: s.grandparents.paternalGrandfather.name || '—',
    relation: 'الجد لأب',
    profession: professionLabel(s.grandparents.paternalGrandfather.profession),
    saved: s.savedGrandparents.paternalGrandfather,
  });
  rows.push({
    serial: n++,
    name: s.grandparents.paternalGrandmother.name || '—',
    relation: 'الجدة لأب',
    profession: professionLabel(s.grandparents.paternalGrandmother.profession),
    saved: s.savedGrandparents.paternalGrandmother,
  });
  rows.push({
    serial: n++,
    name: s.grandparents.maternalGrandfather.name || '—',
    relation: 'الجد لأم',
    profession: professionLabel(s.grandparents.maternalGrandfather.profession),
    saved: s.savedGrandparents.maternalGrandfather,
  });
  rows.push({
    serial: n++,
    name: s.grandparents.maternalGrandmother.name || '—',
    relation: 'الجدة لأم',
    profession: professionLabel(s.grandparents.maternalGrandmother.profession),
    saved: s.savedGrandparents.maternalGrandmother,
  });
  (Object.keys(RELATIVE_LABEL) as RelativeKind[]).forEach((kind) => {
    s.relatives[kind].forEach((m, i) => {
      rows.push({
        serial: n++,
        name: m.name || '—',
        relation: `${RELATIVE_LABEL[kind].singular} ${i + 1}`,
        profession: professionLabel(m.profession),
        saved: s.savedRelatives[kind][i] === true,
      });
    });
  });
  rows.push({
    serial: n++,
    name: s.guardian.name || '—',
    relation: 'ولي الأمر',
    profession: professionLabel(s.guardian.profession),
    saved: s.savedGuardian,
  });
  return rows;
}

/** Same gate as the entry page used for the in-tab "اعتماد" button. */
export function canApproveFamilySnapshot(s: FamilyDataSnapshot): boolean {
  const allGrandparentsSaved =
    s.savedGrandparents.paternalGrandfather &&
    s.savedGrandparents.paternalGrandmother &&
    s.savedGrandparents.maternalGrandfather &&
    s.savedGrandparents.maternalGrandmother;
  const fatherWivesOk =
    !s.hasFatherWives ||
    (s.fatherWives.length > 0 && s.savedFatherWives.every(Boolean));
  const motherHusbandsOk =
    !s.hasMotherHusbands ||
    (s.motherHusbands.length > 0 && s.savedMotherHusbands.every(Boolean));
  const relativesOk = (Object.keys(s.relatives) as RelativeKind[]).every((k) => {
    const list = s.savedRelatives[k];
    return list.length === 0 || list.every(Boolean);
  });
  const guardianOk =
    s.savedGuardian &&
    s.guardian.name.length >= 2 &&
    s.guardian.profession.length > 0 &&
    s.guardian.qualification.length > 0;
  return (
    s.savedFather &&
    s.savedMother &&
    allGrandparentsSaved &&
    fatherWivesOk &&
    motherHusbandsOk &&
    relativesOk &&
    guardianOk
  );
}
