/**
 * Prefill the وثيقة تعارف document from data the applicant already
 * entered earlier in the wizard. Anything the applicant has not yet
 * touched stays empty so on-screen validation correctly prompts them
 * to fill it in.
 *
 * Sources:
 *  - MOI session ([moi-session.mock.ts](moi-session.mock.ts)) — name, NID,
 *    DOB, gender, mobile, governorate, birth district, religion.
 *  - Family snapshot ([familyData.ts](familyData.ts)) — father, mother,
 *    stepparents, grandparents.
 *  - Profile snapshot (optional — [profileData.ts](profileData.ts) is
 *    populated by the submitted-state demo path).
 */

import type { MoiApplicantSession } from './moi-session.mock';
import type { ProfileSnapshot } from './profileData';
import {
  formatMemberName,
  type FamilyDataSnapshot,
  type FamilyMemberForm,
} from './familyData';
import {
  emptyDocument,
  type FatherRecord,
  type GrandparentRecord,
  type MotherRecord,
  type SpouseSubRecord,
  type StudentPersonalRecord,
  type VothiqaTaarufDocument,
} from './vothiqaTaaruf.types';

interface DeriveInput {
  moiSession: MoiApplicantSession | null;
  familySnapshot: FamilyDataSnapshot | null;
  /** Submitted application data (Stage 3/4/5 form + manual personal block).
   *  Source for the education / residence / marital fields that the MOI
   *  session doesn't carry. Optional — empty leaves those fields blank. */
  profileSnapshot?: ProfileSnapshot | null;
  /** Optional cover-page hints (file number, admission year). */
  fileNumber?: string;
  admissionYear?: string;
  committee?: string;
}

export function deriveInitialDocument(input: DeriveInput): VothiqaTaarufDocument {
  const doc = emptyDocument();
  const { moiSession, familySnapshot, profileSnapshot, fileNumber, admissionYear, committee } = input;

  /* ── Cover + personal (نموذج 1) ── */
  doc.personal.cover.fullName = moiSession?.fullName ?? '';
  doc.personal.cover.fileNumber = fileNumber ?? '';
  doc.personal.cover.admissionYear = admissionYear ?? '';
  doc.personal.cover.committee = committee ?? '';
  doc.personal.cover.governorate = moiSession?.birthGovernorate ?? '';
  doc.personal.personal = prefillStudentPersonal(
    doc.personal.personal,
    moiSession,
    fileNumber,
    committee,
  );
  doc.personal.personal = prefillFromProfile(doc.personal.personal, profileSnapshot);

  /* ── Father + Mother (نموذج 2 + 4) ── */
  if (familySnapshot) {
    doc.parents.father = prefillFather(doc.parents.father, familySnapshot.father, familySnapshot.fatherWives[0]);
    doc.parents.mother = prefillMother(doc.parents.mother, familySnapshot.mother, familySnapshot.motherHusbands[0]);
    /* Guardian (نموذج 3) — only when the user supplied one in Stage 7. */
    if (familySnapshot.savedGuardian) {
      const g = familySnapshot.guardian;
      doc.parents.guardian.fullName = [g.firstName, g.secondName, g.thirdName].filter(Boolean).join(' ');
      doc.parents.guardian.qualification = g.qualification;
      doc.parents.guardian.profession = g.profession;
      doc.parents.guardian.workNature = g.workplaceDetail;
    }

    /* ── Grandparents (نموذج 7-10) ── */
    doc.grandparents.paternalGrandfather = prefillGrandparent(
      doc.grandparents.paternalGrandfather,
      familySnapshot.grandparents.paternalGrandfather,
    );
    doc.grandparents.paternalGrandmother = prefillGrandparent(
      doc.grandparents.paternalGrandmother,
      familySnapshot.grandparents.paternalGrandmother,
    );
    doc.grandparents.maternalGrandfather = prefillGrandparent(
      doc.grandparents.maternalGrandfather,
      familySnapshot.grandparents.maternalGrandfather,
    );
    doc.grandparents.maternalGrandmother = prefillGrandparent(
      doc.grandparents.maternalGrandmother,
      familySnapshot.grandparents.maternalGrandmother,
    );
  }

  return doc;
}

function prefillStudentPersonal(
  base: StudentPersonalRecord,
  moi: MoiApplicantSession | null,
  fileNumber: string | undefined,
  committee: string | undefined,
): StudentPersonalRecord {
  if (!moi) return { ...base, fileNumber: fileNumber ?? base.fileNumber, committee: committee ?? base.committee };
  return {
    ...base,
    fullName: moi.fullName,
    fileNumber: fileNumber ?? base.fileNumber,
    committee: committee ?? base.committee,
    dateOfBirth: moi.dateOfBirth,
    nationality: 'مصرية',
    governorate: moi.birthGovernorate,
    birthPlace: moi.birthDistrict,
    religion: moi.religion,
    nationalId: moi.nationalId,
    mobile: moi.mobile,
  };
}

/**
 * Layer the submitted application data (education / residence / marital /
 * contact) onto the student personal record. The MOI session already
 * supplied identity fields; this fills the rest the applicant entered in
 * Stage 3/4/5 so the وثيقة تعارف never re-asks for it. Only writes a field
 * when the snapshot has a value — existing prefill is preserved otherwise.
 */
function prefillFromProfile(
  base: StudentPersonalRecord,
  snapshot: ProfileSnapshot | null | undefined,
): StudentPersonalRecord {
  if (!snapshot) return base;
  const { values, manualPersonal } = snapshot;
  const str = (v: unknown): string =>
    v === undefined || v === null || v === '' ? '' : String(v);
  const firstNonEmpty = (...vals: string[]): string =>
    vals.find((v) => v.trim().length > 0) ?? '';
  const yearOf = (value: string): string => {
    const match = value.match(/(?:19|20)\d{2}/);
    return match ? match[0] : '';
  };

  const out = { ...base };
  const setIfEmpty = (key: keyof StudentPersonalRecord, value: string): void => {
    if (value && !out[key]) (out[key] as string) = value;
  };

  setIfEmpty('shuhraName', str(manualPersonal?.shuhra));
  setIfEmpty('qualificationOrTrack', str(values?.thanawiType));
  setIfEmpty(
    'qualificationYear',
    firstNonEmpty(yearOf(str(values?.thanawiGradDate)), str(values?.bachelorYear)),
  );
  setIfEmpty('totalGrades', str(values?.thanawiTotal));
  setIfEmpty(
    'gradesPercent',
    firstNonEmpty(str(values?.thanawiPercentage), str(values?.bachelorPercentage)),
  );
  setIfEmpty('homePhone', str(values?.homePhone));
  setIfEmpty('address', str(values?.currentAddressDetail));
  if (!out.maritalStatus && (manualPersonal?.maritalStatus === 'single' || manualPersonal?.maritalStatus === 'married')) {
    out.maritalStatus = manualPersonal.maritalStatus;
  }
  return out;
}

function prefillFather(
  base: FatherRecord,
  father: FamilyMemberForm,
  firstWife: FamilyMemberForm | undefined,
): FatherRecord {
  const out: FatherRecord = {
    ...base,
    fullName: formatMemberName(father) === '—' ? '' : formatMemberName(father),
    shuhraName: father.shuhra ?? '',
    dateOfBirth: father.dateOfBirth,
    birthPlace: [father.birthDistrict, father.birthGovernorate].filter(Boolean).join(' — '),
    qualification: father.qualification,
    profession: father.profession,
    seniorityNumber: father.seniorityNumber ?? '',
    workplace: father.professionDetail,
    workNature: father.qualificationDetail,
    address: [father.residenceDetail, father.residenceDistrict, father.residenceGovernorate]
      .filter(Boolean)
      .join(' — '),
    nationalId: father.nationalId,
    deceased: father.deceased,
  };
  if (firstWife) {
    out.hasCurrentWife = true;
    out.currentWifeCount = '1';
    out.currentWife = mapToSpouseSub(firstWife);
  }
  return out;
}

function prefillMother(
  base: MotherRecord,
  mother: FamilyMemberForm,
  firstHusband: FamilyMemberForm | undefined,
): MotherRecord {
  const out: MotherRecord = {
    ...base,
    fullName: formatMemberName(mother) === '—' ? '' : formatMemberName(mother),
    dateOfBirth: mother.dateOfBirth,
    birthPlace: [mother.birthDistrict, mother.birthGovernorate].filter(Boolean).join(' — '),
    qualification: mother.qualification,
    religion: mother.religion,
    profession: mother.profession,
    seniorityNumber: mother.seniorityNumber ?? '',
    workplace: mother.professionDetail,
    workNature: mother.qualificationDetail,
    address: [mother.residenceDetail, mother.residenceDistrict, mother.residenceGovernorate]
      .filter(Boolean)
      .join(' — '),
    nationalId: mother.nationalId,
    deceased: mother.deceased,
  };
  if (firstHusband) {
    out.hasCurrentHusband = true;
    out.currentHusbandCount = '1';
    out.currentHusband = mapToSpouseSub(firstHusband);
  }
  return out;
}

function prefillGrandparent(
  base: GrandparentRecord,
  src: FamilyMemberForm,
): GrandparentRecord {
  const display = formatMemberName(src);
  return {
    ...base,
    fullName: display === '—' ? '' : display,
    shuhraName: src.shuhra ?? '',
    dateOfBirth: src.dateOfBirth,
    birthPlace: src.birthDistrict,
    governorate: src.birthGovernorate,
    religion: src.religion,
    alive: src.deceased ? 'deceased' : 'alive',
    nationalId: src.nationalId,
    nidUnavailable: src.nidUnavailable,
    nidUnavailableReason: src.nidUnavailableReason,
    qualification: src.qualification,
    profession: src.profession,
    seniorityNumber: src.seniorityNumber ?? '',
    workplace: src.professionDetail,
    workNature: src.qualificationDetail,
    address: [src.residenceDetail, src.residenceDistrict, src.residenceGovernorate]
      .filter(Boolean)
      .join(' — '),
  };
}

function mapToSpouseSub(m: FamilyMemberForm): SpouseSubRecord {
  return {
    fullName: formatMemberName(m) === '—' ? '' : formatMemberName(m),
    dateOfBirth: m.dateOfBirth,
    nationalId: m.nationalId,
    qualification: m.qualification,
    birthPlace: [m.birthDistrict, m.birthGovernorate].filter(Boolean).join(' — '),
    profession: m.profession,
    seniorityNumber: m.seniorityNumber ?? '',
    workplace: m.professionDetail,
    workNature: m.qualificationDetail,
  };
}
