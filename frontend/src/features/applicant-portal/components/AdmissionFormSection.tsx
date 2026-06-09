/**
 * طلب الإلتحاق — printable + on-screen application-form section.
 *
 * Rebuilt 2026-05-24 to match the client-supplied paper template
 * (`docs/references/admission-form/*.png`) exactly in structure, order,
 * and visual treatment:
 *   1. Boxed title «طلب إلتحاق بكلية الشرطة».
 *   2. Letter greeting to «السيد اللواء / مدير كلية الشرطة».
 *   3. بيانات الطالب — two-column key/value layout.
 *   4. بيانات الأسرة — parent / guardian / mother + telephones row.
 *   5. الإخوة table.
 *   6. الجد والجدة للوالد + الجد والجدة للوالدة tables.
 *   7. الأخوات / الأعمام / العمات / الأخوال / الخالات tables.
 *   8. إقرار + signature footer.
 *
 * Visual treatment: black-and-white, no teal/gold accents — the print
 * is meant to look like a Ministry intake form, not the rest of the
 * digital chrome. A print-only watermark (`StudentNameWatermark`) prints
 * the applicant's full name diagonally across every page at low opacity.
 *
 * Data sources (all read-only):
 *   - MOI session  (store: moiSession)
 *   - Wizard store (paymentReference, firstExamDate, selectedCategoryKey,
 *                   selectedFaculty, selectedSpecialization, paymentMethod)
 *   - Profile snapshot (Stage345 form values + manualPersonal)
 *   - Draft family data (Stage7 family blob) with session snapshot fallback
 */

import { useMemo } from 'react';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { loadProfileSnapshot } from '../lib/profileData';
import {
  EMPTY_GUARDIAN,
  EMPTY_MEMBER,
  formatMemberName,
  loadFamilySnapshot,
  professionLabel,
  type GrandparentsForm,
  type GuardianForm,
  type FamilyMemberForm,
  type RelativeKind,
} from '../lib/familyData';
import type { ApplicantDraft } from '@/shared/types/domain';

const RELATIVE_KINDS: readonly RelativeKind[] = [
  'brothers',
  'sisters',
  'paternal_uncles',
  'paternal_aunts',
  'maternal_aunts',
  'maternal_uncles',
];

const GRANDPARENT_KEYS: readonly (keyof GrandparentsForm)[] = [
  'paternalGrandfather',
  'paternalGrandmother',
  'maternalGrandfather',
  'maternalGrandmother',
];

const MARITAL_LABEL: Record<string, string> = {
  single: 'أعزب',
  married: 'متزوج',
  divorced: 'مطلق',
  widowed: 'أرمل',
};

interface Props {
  fileNumber: string;
  draft?: ApplicantDraft;
  breakBefore?: boolean;
}

export function AdmissionFormSection({
  fileNumber: _fileNumber,
  draft,
  breakBefore = true,
}: Props): JSX.Element {
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const storeNid = useApplicantPortalStore((s) => s.nationalId);
  const selectedFaculty = useApplicantPortalStore((s) => s.selectedFaculty);

  const profile = useMemo(() => loadProfileSnapshot(), []);
  const family = useMemo(
    () => readDraftFamily(draft?.family) ?? readSessionFamily(),
    [draft?.family],
  );

  const v = profile?.values ?? null;
  const mp = profile?.manualPersonal ?? null;
  const submittedProfile = draft?.profile;

  const fullName = readProfileString(submittedProfile, 'fullName') || moiSession?.fullName || mp?.fullName || '';
  const nationalId = readProfileString(submittedProfile, 'nationalId') || moiSession?.nationalId || storeNid || '';
  const dob = readProfileString(submittedProfile, 'dateOfBirthAr') || moiSession?.dateOfBirthAr || mp?.dateOfBirthAr || '';
  const birthGov = readProfileString(submittedProfile, 'birthGovernorate') || moiSession?.birthGovernorate || mp?.birthGovernorate || '';
  const birthDistrict =
    readProfileString(submittedProfile, 'birthDistrict') ||
    moiSession?.birthDistrict ||
    mp?.birthDistrict ||
    v?.birthDistrict ||
    '';
  const mobile = readProfileString(submittedProfile, 'mobile') || moiSession?.mobile || mp?.mobile || '';
  const maritalCode = readProfileString(submittedProfile, 'maritalStatus') || mp?.maritalStatus || '';
  const marital = maritalCode ? MARITAL_LABEL[maritalCode] ?? '' : '';

  const facultyText =
    readProfileString(submittedProfile, 'bachelorFaculty') ||
    selectedFaculty ||
    v?.bachelorFaculty ||
    '';
  const universityText = readProfileString(submittedProfile, 'bachelorUniversity') || v?.bachelorUniversity || '';
  const bachelorYearText =
    readProfileString(submittedProfile, 'bachelorYear') ||
    (v?.bachelorYear != null && v?.bachelorYear !== '' ? String(v.bachelorYear) : '');
  const bachelorGradeText = readProfileString(submittedProfile, 'bachelorGrade') || v?.bachelorGrade || '';
  const thanawiTotalText = readProfileString(submittedProfile, 'thanawiTotal') ||
    (v?.thanawiTotal != null ? String(v.thanawiTotal) : '');
  const thanawiPercentageText = formatPercentField(
    readProfileString(submittedProfile, 'thanawiPercentage') ||
      (v?.thanawiPercentage != null ? String(v.thanawiPercentage) : ''),
  );
  const bachelorPercentageText = formatPercentField(
    readProfileString(submittedProfile, 'bachelorPercentage') ||
      (v?.bachelorPercentage != null && v.bachelorPercentage !== '' ? String(v.bachelorPercentage) : ''),
  );
  /* The PDF reads «المؤهل» as the bachelor degree title (دبلوم/ليسانس/بكالوريوس/…)
   * not the level code. Fall back to a sensible textual description if
   * the profile only carries the level. */
  const qualificationLevel =
    readProfileString(submittedProfile, 'qualificationLevel') || profile?.qualificationLevel || '';
  const qualificationText =
    qualificationLevel === 'master'
      ? 'ماجستير'
      : qualificationLevel === 'doctorate'
        ? 'دكتوراه'
        : 'بكالوريوس';

  const addressLine = [
    readProfileString(submittedProfile, 'currentAddressDetail') || v?.currentAddressDetail,
    readProfileString(submittedProfile, 'addressDistrict') || v?.addressDistrict,
    readProfileString(submittedProfile, 'addressGovernorate') || v?.addressGovernorate,
  ]
    .filter(Boolean)
    .join(' — ');
  const homePhone = readProfileString(submittedProfile, 'homePhone') || v?.homePhone || '';

  /* Nationality + governorate-of-birth are emitted from the MOI session;
   * keep both visible even when one is missing. */
  const nationality = 'مصرية';
  const birthLine = [dob, [birthGov, birthDistrict].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(' — ');

  /* Family data — derive each row safely. */
  const father = family?.father;
  const mother = family?.mother;
  const guardian = family?.guardian;
  const fatherProfession = father ? printProfession(father) : '';
  const motherProfession = mother ? printProfession(mother) : '';
  const guardianProfession = guardian ? printGuardianProfession(guardian) : '';
  const fatherName = father ? printMemberName(father) : '';
  const motherName = mother ? printMemberName(mother) : '';
  const guardianName = guardian ? printGuardianName(guardian) : '';
  /* "المؤهل" in the family block prints the dropdown value verbatim
   * — these are free-text fields in Stage 7 so we don't translate. */
  const fatherQualification = father ? printQualification(father) : '';
  const motherQualification = mother ? printQualification(mother) : '';
  const guardianQualification = guardian ? printGuardianQualification(guardian) : '';
  /* Same for «عمل / محمول» under the family block — Stage 7 doesn't
   * collect a household work phone or a family mobile separately, so
   * we surface the father's mobile when available. */
  const familyHomePhone = homePhone;
  const familyWorkPhone = '';
  const familyMobilePhone = mobile;

  return (
    <div
      className={breakBefore ? 'admission-form mt-8 print:break-before-page' : 'admission-form'}
      style={{ breakBefore: breakBefore ? 'page' : 'auto', fontFamily: 'var(--font-ar)', color: '#000' }}
    >
      {/* Print-only watermark — student name diagonally across every printed page. */}
      <StudentNameWatermark name={fullName} />

      {/* ── Boxed title ─────────────────────────────────────────── */}
      <div className="admission-title">
        <div className="admission-title-inner">طلب إلتحاق بكلية الشرطة</div>
      </div>

      {/* ── Letter greeting ─────────────────────────────────────── */}
      <div className="admission-letter">
        <div className="letter-row-top">
          <span>السيد اللواء / مدير كلية الشرطة</span>
        </div>
        <div className="letter-greeting">تحية طيبة وبعد ،،،</div>
        <div className="letter-body">
          <p>
            أرجو الوافقة على قبول أوراق الطالب /{' '}
            <span className="filled">{fullName}</span> للإلتحاق بكلية الشرطة فى العام الدراسى
            ........................
          </p>
          <p>مع الإحاطة بأن بياناته كما يلى :</p>
        </div>
      </div>

      {/* ── بيانات الطالب ────────────────────────────────────────── */}
      <h3 className="admission-section-heading">بيانات الطالب :</h3>
      <div className="admission-grid two-col">
        <Field label="المؤهل" value={qualificationText} />
        <Field label="تاريخ الحصول على المؤهل" value={bachelorYearText} />
        <Field label="الكلية" value={facultyText} />
        <Field label="الجامعة" value={universityText} />
        <Field label="تقدير الجامعة" value={bachelorGradeText} />
        <Field label="مجموع الثانوية العامة" value={thanawiTotalText} />
        <Field label="النسبة المئوية للثانوية العامة" value={thanawiPercentageText} />
        <Field label="النسبة المئوية للجامعة" value={bachelorPercentageText} />
        <Field label="الحالة الإجتماعية" value={marital} />
        <Field label="تاريخ ومحل الميلاد" value={birthLine} />
        <Field label="الجنسية" value={nationality} />
        <Field label="محل الإقامة" value={addressLine} colSpan={2} />
        <Field
          label="رقم التليفون"
          colSpan={2}
          customValue={
            <span className="phones-line">
              <span>المنزل :</span>
              <span className="filled phone">{homePhone || '....................'}</span>
              <span className="phone-gap">محمول :</span>
              <span className="filled phone">{mobile || '....................'}</span>
            </span>
          }
        />
      </div>

      {/* ── بيانات الأسرة ───────────────────────────────────────── */}
      <h3 className="admission-section-heading">بيانات الأسرة :</h3>
      <div className="admission-grid two-col">
        <Field label="إسم الوالد" value={fatherName} />
        <Field label="المؤهل" value={fatherQualification} />
        <Field
          label="وظيفة الوالد"
          value={fatherProfession}
          rightNote="( مع إرفاق أصل المستند الدال على المؤهل والوظيفة )"
        />
        <Field label="إسم والى الأمر" value={guardianName} />
        <Field label="المؤهل" value={guardianQualification} />
        <Field
          label="وظيفة ولى الأمر"
          value={guardianProfession}
          rightNote="( مع إرفاق أصل المستند الدال على المؤهل والوظيفة )"
        />
        <Field label="إسم الأم" value={motherName} />
        <Field label="المؤهل" value={motherQualification} />
        <Field
          label="وظيفة الأم"
          value={motherProfession}
          rightNote="( مع إرفاق أصل المستند الدال على المؤهل والوظيفة )"
        />
        <Field
          label="رقم التليفون"
          colSpan={2}
          customValue={
            <span className="phones-line">
              <span>المنزل :</span>
              <span className="filled phone">{familyHomePhone || '....................'}</span>
              <span className="phone-gap">عمل :</span>
              <span className="filled phone">{familyWorkPhone || '....................'}</span>
              <span className="phone-gap">محمول :</span>
              <span className="filled phone">{familyMobilePhone || '....................'}</span>
            </span>
          }
        />
      </div>

      {/* ── الإخوة ──────────────────────────────────────────────── */}
      <RelativeTable title="الإخوة" members={family?.relatives.brothers ?? []} />

      {/* ── Paternal grandparents ───────────────────────────────── */}
      <RelativeTable
        title="الجد والجدة للوالد"
        members={
          family
            ? [
                family.grandparents.paternalGrandfather,
                family.grandparents.paternalGrandmother,
              ].filter((member): member is FamilyMemberForm => Boolean(member))
            : []
        }
      />

      {/* ── Maternal grandparents ───────────────────────────────── */}
      <RelativeTable
        title="الجد والجدة للوالدة"
        members={
          family
            ? [
                family.grandparents.maternalGrandfather,
                family.grandparents.maternalGrandmother,
              ].filter((member): member is FamilyMemberForm => Boolean(member))
            : []
        }
      />

      {/* ── الأخوات ─────────────────────────────────────────────── */}
      <RelativeTable title="الأخوات" members={family?.relatives.sisters ?? []} />

      {/* ── الأعمام ─────────────────────────────────────────────── */}
      <RelativeTable title="الأعمام" members={family?.relatives.paternal_uncles ?? []} />

      {/* ── العمات ──────────────────────────────────────────────── */}
      <RelativeTable title="العمات" members={family?.relatives.paternal_aunts ?? []} />

      {/* ── الأخوال ─────────────────────────────────────────────── */}
      <RelativeTable title="الأخوال" members={family?.relatives.maternal_uncles ?? []} />

      {/* ── الخالات ─────────────────────────────────────────────── */}
      <RelativeTable title="الخالات" members={family?.relatives.maternal_aunts ?? []} />

      {/* ── إقرار + signatures ──────────────────────────────────── */}
      <div className="admission-declaration">
        <h3 className="declaration-title">إقرار</h3>
        <p className="declaration-actor">
          إقر أنا الطالب / <span className="filled">{fullName}</span>
        </p>
        <p className="declaration-body">
          راغب الإلتحاق كطالب تحت الإختبار بكلية الشرطة بأن البيانات الواردة بطلب الإلتحاق صحيحة
          تماماً ومطابقة للحقيقة وأنى مسئول مسئولية كاملة عن أي مخالفة أو خطأ فى هذه البيانات كما
          أقر بحق كلية الشرطة فى فصلى خلال فترة الدراسة إذا تبين أن بعض أو كل هذه البيانات غير
          صحيحة وغير مطابقة للواقع أو تبين إغفال بيانات مطلوب إثباتها أو تبين إثبات بيانات غير
          صحيحة بصفة عامة.
        </p>
      </div>

      <div className="admission-signature">
        <div className="sig-block">
          <div className="sig-line">
            <span className="sig-label">توقيع الطالب :</span>
            <span className="sig-fill">....................</span>
          </div>
          <div className="sig-line">
            <span className="sig-label">رقم البطاقة الشخصية :</span>
            <span className="filled" dir="ltr">{nationalId || '....................'}</span>
          </div>
        </div>
        <div className="sig-block">
          <div className="sig-line">
            <span className="sig-label">توقيع والى الأمر :</span>
            <span className="sig-fill">....................</span>
          </div>
          <div className="sig-line">
            <span className="sig-label">تحريراً فى :</span>
            <span className="sig-fill" dir="ltr">/&nbsp;&nbsp;/&nbsp;&nbsp;20</span>
          </div>
        </div>
      </div>

      <style>{ADMISSION_FORM_CSS}</style>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Pieces
 * ──────────────────────────────────────────────────────────────────── */

interface FieldProps {
  label: string;
  value?: string;
  customValue?: React.ReactNode;
  colSpan?: 1 | 2;
  rightNote?: string;
}

function Field({ label, value, customValue, colSpan = 1, rightNote }: FieldProps): JSX.Element {
  const displayValue =
    value && value.trim().length > 0 ? value : '...........................................';
  return (
    <div className={`admission-field${colSpan === 2 ? ' span-2' : ''}${rightNote ? ' with-note' : ''}`}>
      <span className="admission-field-label">{label} :</span>
      <span className="admission-field-value">
        {customValue ?? <span className="filled">{displayValue}</span>}
      </span>
      {rightNote && <span className="admission-field-note">{rightNote}</span>}
    </div>
  );
}

interface RelativeTableProps {
  title: string;
  members: ReadonlyArray<FamilyMemberForm>;
}

function RelativeTable({ title, members }: RelativeTableProps): JSX.Element {
  /* Filter out members with no name so the printed table doesn't show
   * blank entries from default-initialized grandparent/wife slots. */
  const rows = members.filter((m) => printMemberName(m).length > 0);

  return (
    <section className="admission-table">
      <div className="admission-table-title">{title}</div>
      {rows.length === 0 ? (
        <div className="admission-table-empty">لا يوجد</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="col-serial">مسلسل</th>
              <th>الأسم</th>
              <th>الوظيفة</th>
              <th className="col-qualification">المؤهل الدراسى</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={`${title}-${i}`}>
                <td className="col-serial">{toArabicNumeral(i + 1)}</td>
                <td>{printMemberName(m)}</td>
                <td>{printProfession(m)}</td>
                <td>{printQualification(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

interface FamilyPrintData {
  father?: FamilyMemberForm;
  mother?: FamilyMemberForm;
  fatherWives: readonly FamilyMemberForm[];
  motherHusbands: readonly FamilyMemberForm[];
  grandparents: Partial<Record<keyof GrandparentsForm, FamilyMemberForm>>;
  relatives: Partial<Record<RelativeKind, readonly FamilyMemberForm[]>>;
  guardian?: GuardianForm;
}

function readSessionFamily(): FamilyPrintData | null {
  const snapshot = loadFamilySnapshot();
  if (!snapshot) return null;
  return {
    father: nonEmptyMember(snapshot.father),
    mother: nonEmptyMember(snapshot.mother),
    fatherWives: snapshot.fatherWives.filter(nonEmptyMember),
    motherHusbands: snapshot.motherHusbands.filter(nonEmptyMember),
    grandparents: Object.fromEntries(
      GRANDPARENT_KEYS.flatMap((key) => {
        const member = nonEmptyMember(snapshot.grandparents[key]);
        return member ? [[key, member]] : [];
      }),
    ) as Partial<Record<keyof GrandparentsForm, FamilyMemberForm>>,
    relatives: Object.fromEntries(
      RELATIVE_KINDS.flatMap((kind) => {
        const members = snapshot.relatives[kind].filter(nonEmptyMember);
        return members.length > 0 ? [[kind, members]] : [];
      }),
    ) as Partial<Record<RelativeKind, readonly FamilyMemberForm[]>>,
    guardian: nonEmptyGuardian(snapshot.guardian),
  };
}

function readDraftFamily(rawFamily: unknown): FamilyPrintData | null {
  if (!isRecord(rawFamily)) return null;
  const relatives = readRelatives(rawFamily.relatives);
  appendFlatSiblings(relatives, rawFamily.siblings);
  appendFlatRelatives(relatives, rawFamily.relatives);
  const grandparentsNode = isRecord(rawFamily.grandparents) ? rawFamily.grandparents : rawFamily;
  const family: FamilyPrintData = {
    father: readFamilyMember(rawFamily.father),
    mother: readFamilyMember(rawFamily.mother),
    fatherWives: readFamilyMemberArray(rawFamily.fatherWives),
    motherHusbands: readFamilyMemberArray(rawFamily.motherHusbands),
    grandparents: readGrandparents(grandparentsNode),
    relatives,
    guardian: readGuardian(rawFamily.guardian),
  };

  return hasFamilyData(family) ? family : null;
}

function appendFlatSiblings(
  relatives: Partial<Record<RelativeKind, readonly FamilyMemberForm[]>>,
  rawSiblings: unknown,
): void {
  const siblingNodes = Array.isArray(rawSiblings) ? rawSiblings : [];
  for (const siblingNode of siblingNodes) {
    const sibling = readFamilyMember(siblingNode);
    if (!sibling) continue;
    appendRelative(relatives, siblingRelationKind(siblingNode), sibling);
  }
}

function appendFlatRelatives(
  relatives: Partial<Record<RelativeKind, readonly FamilyMemberForm[]>>,
  rawRelatives: unknown,
): void {
  const relativeNodes = Array.isArray(rawRelatives) ? rawRelatives : [];
  for (const relativeNode of relativeNodes) {
    const relative = readFamilyMember(relativeNode);
    const kind = readRelativeKind(relativeNode);
    if (!relative || !kind) continue;
    appendRelative(relatives, kind, relative);
  }
}

function appendRelative(
  relatives: Partial<Record<RelativeKind, readonly FamilyMemberForm[]>>,
  kind: RelativeKind,
  member: FamilyMemberForm,
): void {
  relatives[kind] = [...(relatives[kind] ?? []), member];
}

function siblingRelationKind(rawSibling: unknown): RelativeKind {
  return isRecord(rawSibling) && readString(rawSibling, 'relationshipId') === 'الأخت'
    ? 'sisters'
    : 'brothers';
}

function readGrandparents(value: Record<string, unknown>): Partial<Record<keyof GrandparentsForm, FamilyMemberForm>> {
  const grandparents: Partial<Record<keyof GrandparentsForm, FamilyMemberForm>> = {};
  for (const key of GRANDPARENT_KEYS) {
    const member = readFamilyMember(value[key]);
    if (member) grandparents[key] = member;
  }
  return grandparents;
}

function readRelatives(rawRelatives: unknown): Partial<Record<RelativeKind, readonly FamilyMemberForm[]>> {
  if (!isRecord(rawRelatives)) return {};
  const relatives: Partial<Record<RelativeKind, readonly FamilyMemberForm[]>> = {};
  for (const kind of RELATIVE_KINDS) {
    const members = readFamilyMemberArray(rawRelatives[kind]);
    if (members.length > 0) relatives[kind] = members;
  }
  return relatives;
}

function readRelativeKind(rawRelative: unknown): RelativeKind | null {
  if (!isRecord(rawRelative)) return null;
  const relationship = readString(rawRelative, 'relationshipId');
  if (relationship === 'العم') return 'paternal_uncles';
  if (relationship === 'العمة') return 'paternal_aunts';
  if (relationship === 'الخال') return 'maternal_uncles';
  if (relationship === 'الخالة') return 'maternal_aunts';
  return null;
}

function readFamilyMemberArray(rawMembers: unknown): readonly FamilyMemberForm[] {
  if (!Array.isArray(rawMembers)) return [];
  return rawMembers
    .map(readFamilyMember)
    .filter((member): member is FamilyMemberForm => Boolean(member));
}

function readFamilyMember(rawMember: unknown): FamilyMemberForm | undefined {
  if (!isRecord(rawMember)) return undefined;
  return nonEmptyMember(familyMemberFromRecord(rawMember));
}

function familyMemberFromRecord(rawMember: Record<string, unknown>): FamilyMemberForm {
  const fullName = readString(rawMember, 'fullName');
  const member: FamilyMemberForm = {
    ...EMPTY_MEMBER,
    firstName: readString(rawMember, 'firstName') || fullName,
    secondName: readString(rawMember, 'secondName'),
    thirdName: readString(rawMember, 'thirdName'),
    nationalId: readString(rawMember, 'nationalId'),
    nidUnavailable: readBoolean(rawMember, 'nidUnavailable') ?? false,
    nidUnavailableReason: readUnavailableReason(rawMember),
    shuhra: readString(rawMember, 'shuhra'),
    religion: readString(rawMember, 'religion') === 'مسيحي' ? 'مسيحي' : 'مسلم',
    dateOfBirth: readString(rawMember, 'dateOfBirth'),
    birthGovernorate: readString(rawMember, 'birthGovernorate'),
    birthDistrict: readString(rawMember, 'birthDistrict'),
    deceased: readBoolean(rawMember, 'deceased') ?? readBoolean(rawMember, 'alive') === false,
    residenceGovernorate: readString(rawMember, 'residenceGovernorate') || readString(rawMember, 'governorate'),
    residenceDistrict: readString(rawMember, 'residenceDistrict'),
    residenceDetail: readString(rawMember, 'residenceDetail'),
    profession: readString(rawMember, 'profession') || readString(rawMember, 'occupation'),
    seniorityNumber: readString(rawMember, 'seniorityNumber'),
    qualification: readString(rawMember, 'qualification') || readString(rawMember, 'education'),
    qualificationDetail: readString(rawMember, 'qualificationDetail'),
    professionDetail: readString(rawMember, 'professionDetail'),
  };
  return member;
}

function readGuardian(rawGuardian: unknown): GuardianForm | undefined {
  if (!isRecord(rawGuardian)) return undefined;
  const fullName = readString(rawGuardian, 'fullName');
  const guardian: GuardianForm = {
    ...EMPTY_GUARDIAN,
    firstName: readString(rawGuardian, 'firstName') || fullName,
    secondName: readString(rawGuardian, 'secondName'),
    thirdName: readString(rawGuardian, 'thirdName'),
    nationalId: readString(rawGuardian, 'nationalId'),
    profession: readString(rawGuardian, 'profession') || readString(rawGuardian, 'occupation'),
    seniorityNumber: readString(rawGuardian, 'seniorityNumber'),
    qualification: readString(rawGuardian, 'qualification') || readString(rawGuardian, 'education'),
    qualificationDetail: readString(rawGuardian, 'qualificationDetail'),
    professionDetail: readString(rawGuardian, 'professionDetail'),
    workplaceDetail: readString(rawGuardian, 'workplaceDetail') || readString(rawGuardian, 'governorate'),
  };
  return nonEmptyGuardian(guardian);
}

function hasFamilyData(family: FamilyPrintData): boolean {
  return Boolean(
    family.father ||
      family.mother ||
      family.fatherWives.length > 0 ||
      family.motherHusbands.length > 0 ||
      Object.values(family.grandparents).some(Boolean) ||
      Object.values(family.relatives).some((rows) => (rows?.length ?? 0) > 0) ||
      family.guardian,
  );
}

function nonEmptyMember(member: FamilyMemberForm): FamilyMemberForm | undefined {
  return printMemberName(member).length > 0 || member.nationalId.trim().length > 0
    ? member
    : undefined;
}

function nonEmptyGuardian(guardian: GuardianForm): GuardianForm | undefined {
  return printGuardianName(guardian).length > 0 || guardian.workplaceDetail.trim().length > 0
    ? guardian
    : undefined;
}

function printMemberName(member: FamilyMemberForm): string {
  const name = formatMemberName(member);
  return name === '—' ? '' : name;
}

function printGuardianName(guardian: GuardianForm): string {
  return [guardian.firstName, guardian.secondName, guardian.thirdName]
    .map((namePart) => namePart.trim())
    .filter(Boolean)
    .join(' ');
}

function printProfession(member: FamilyMemberForm): string {
  return labeledOrRaw(member.profession, member.professionDetail);
}

function printGuardianProfession(guardian: GuardianForm): string {
  return labeledOrRaw(guardian.profession, guardian.professionDetail);
}

function printQualification(member: FamilyMemberForm): string {
  return member.qualificationDetail.trim() || member.qualification.trim();
}

function printGuardianQualification(guardian: GuardianForm): string {
  return guardian.qualificationDetail.trim() || guardian.qualification.trim();
}

function labeledOrRaw(codeOrText: string, detail?: string): string {
  const detailText = detail?.trim() ?? '';
  if (detailText) return detailText;
  const raw = codeOrText.trim();
  if (!raw) return '';
  const label = professionLabel(raw);
  return label === '—' ? raw : label;
}

function readString(record: Record<string, unknown>, key: string): string {
  const field = record[key];
  if (typeof field === 'string') return field.trim();
  if (typeof field === 'number') return String(field);
  return '';
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const field = record[key];
  return typeof field === 'boolean' ? field : undefined;
}

function readUnavailableReason(
  record: Record<string, unknown>,
): FamilyMemberForm['nidUnavailableReason'] {
  const value = readString(record, 'nidUnavailableReason');
  return value === 'fallen_record' || value === 'born_abroad' ? value : '';
}

function isRecord(unknownValue: unknown): unknownValue is Record<string, unknown> {
  return typeof unknownValue === 'object' && unknownValue !== null;
}

function StudentNameWatermark({ name }: { name: string }): JSX.Element | null {
  const text = name.trim();
  if (!text) return null;
  /* Render a small, repetitive watermark by tiling a tiny inline-SVG
   * across the whole page. Each tile shows the name once at -28°;
   * `background-repeat: repeat` does the rest. The SVG is encoded as
   * a data URI so we don't need a separate asset. */
  const tileWidth = 240;
  const tileHeight = 96;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}"><text x="${tileWidth / 2}" y="${tileHeight / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Cairo, sans-serif" font-size="16" fill="rgba(0,0,0,0.16)" transform="rotate(-28 ${tileWidth / 2} ${tileHeight / 2})">${escapeSvgText(text)}</text></svg>`;
  const dataUri = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  return (
    <div
      aria-hidden
      className="admission-watermark"
      style={{ backgroundImage: dataUri }}
    />
  );
}

function escapeSvgText(s: string): string {
  return s.replace(/[<>&"']/g, (c) => {
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '&') return '&amp;';
    if (c === '"') return '&quot;';
    return '&apos;';
  });
}

function readProfileString(
  profile: ApplicantDraft['profile'] | undefined,
  key: keyof NonNullable<ApplicantDraft['profile']>,
): string {
  const value = profile?.[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function formatPercentField(value: string): string {
  const trimmed = value.trim();
  return trimmed ? `${trimmed}%` : '';
}

function toArabicNumeral(n: number): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n)
    .split('')
    .map((d) => map[Number(d)] ?? d)
    .join('');
}

/* ────────────────────────────────────────────────────────────────────
 * Print-faithful stylesheet (scoped to .admission-form)
 * ──────────────────────────────────────────────────────────────────── */

const ADMISSION_FORM_CSS = `
.admission-form { font-family: var(--font-ar); color: #000; line-height: 1.7; }

/* Title box */
.admission-title {
  border-top: 3px solid #000;
  border-bottom: 3px solid #000;
  padding: 6mm 0 5mm;
  margin-bottom: 10mm;
  text-align: center;
}
.admission-title-inner {
  display: inline-block;
  border: 2px solid #000;
  padding: 4mm 14mm;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

/* Letter */
.admission-letter { margin-bottom: 6mm; font-size: 13px; }
.letter-row-top { display: flex; justify-content: flex-start; font-weight: 700; }
.letter-greeting { text-align: center; margin: 3mm 0; font-weight: 700; }
.letter-body p { margin: 0 0 1.5mm; }
.letter-body .filled { border-bottom: 1px dotted #000; padding: 0 4px; min-width: 60mm; display: inline-block; text-align: center; font-weight: 600; }

/* Section headings */
.admission-section-heading {
  margin: 6mm 0 3mm;
  font-size: 14px;
  font-weight: 800;
  border-bottom: 1px solid #000;
  padding-bottom: 1.5mm;
}

/* Two-column key/value grid */
.admission-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3mm 8mm;
  margin-bottom: 4mm;
  font-size: 12.5px;
}
.admission-field { display: flex; align-items: baseline; gap: 4px; min-width: 0; }
.admission-field.span-2 { grid-column: 1 / -1; }
.admission-field.with-note { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.admission-field-label { font-weight: 700; white-space: nowrap; }
.admission-field-value { flex: 1; min-width: 0; }
.admission-field-note { font-size: 11.5px; font-style: italic; }
.admission-field .filled {
  display: inline-block;
  border-bottom: 1px dotted #000;
  padding: 0 4px;
  min-width: 40mm;
  font-weight: 600;
}
.phones-line { display: inline-flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
.phones-line .phone-gap { margin-inline-start: 8mm; font-weight: 700; }
.phones-line .phone { min-width: 30mm; }

/* Relative tables */
.admission-table { margin: 4mm 0; break-inside: avoid; }
.admission-table-title {
  border: 1.5px solid #000;
  text-align: center;
  font-weight: 800;
  padding: 1.5mm 0;
  font-size: 13px;
}
.admission-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.admission-table th, .admission-table td {
  border: 1.5px solid #000;
  padding: 2mm 2mm;
  text-align: center;
  vertical-align: middle;
  min-height: 9mm;
}
.admission-table thead th { font-weight: 800; background: #fff; }
.admission-table .col-serial { width: 14mm; }
.admission-table .col-qualification { width: 45mm; }
.admission-table-empty {
  border: 1.5px solid #000;
  border-top: 0;
  text-align: center;
  padding: 3mm 0;
  font-weight: 600;
  font-size: 12.5px;
}

/* Declaration block */
.admission-declaration { margin-top: 8mm; break-inside: avoid; }
.declaration-title { text-align: center; font-size: 16px; font-weight: 800; margin: 4mm 0 3mm; }
.declaration-actor { font-size: 13px; font-weight: 700; margin-bottom: 3mm; }
.declaration-actor .filled { border-bottom: 1px dotted #000; padding: 0 4px; min-width: 60mm; display: inline-block; font-weight: 600; }
.declaration-body { font-size: 12.5px; line-height: 1.9; text-align: justify; }

/* Signatures */
.admission-signature {
  margin-top: 8mm;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6mm 12mm;
  font-size: 12.5px;
}
.sig-block { display: flex; flex-direction: column; gap: 3mm; }
.sig-line { display: flex; align-items: baseline; gap: 4px; }
.sig-label { font-weight: 700; white-space: nowrap; }
.sig-fill { flex: 1; border-bottom: 1px dotted #000; min-height: 1em; padding: 0 4px; font-weight: 600; }
.sig-line .filled { border-bottom: 1px dotted #000; padding: 0 4px; min-width: 30mm; font-weight: 600; }

/* Student-name watermark — print only. Tiled small text repeats
 * across every printed page via a data-URI SVG background. */
.admission-watermark { display: none; }
@media print {
  .admission-watermark {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-repeat: repeat;
    background-position: top left;
    /* Ensure the tiled background prints (browsers may strip
     * decorative backgrounds by default). */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Make sure the rest of the form sits visually above the watermark. */
  .admission-form > *:not(.admission-watermark) {
    position: relative;
    z-index: 1;
  }
}

@media print {
  /* ── Page reset ────────────────────────────────────────────────
   * Zero out @page margins and html/body padding so the article
   * itself owns the visible margins. Without this the (asymmetric)
   * page-engine margins + PrintLayout's fixed-width article fight
   * each other and the content drifts to one edge of the sheet
   * (the bug the user reported on 2026-05-24).
   *
   * Clear every @top-*/@bottom-* slot so the architecture-page
   * handout footer («…Technical Reference — Page X of Y») that
   * print.css carries globally doesn't leak into this print.
   * Scoped via body:has(.admission-form) on all the descendant
   * overrides so other features' prints are untouched. */
  @page {
    size: A4 portrait;
    margin: 8mm !important;
    @top-left      { content: ""; }
    @top-center    { content: ""; }
    @top-right     { content: ""; }
    @bottom-left   { content: ""; }
    @bottom-center { content: ""; }
    @bottom-right  { content: ""; }
  }
  body:has(.admission-form),
  html:has(.admission-form) {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  /* ── Collapse upstream layout so the PrintLayout article fills the
   * page. Without this, the wizard renders a 2-column grid with the
   * stepper in the inline-start column and the content (containing
   * the article) in the inline-end column — the article gets squeezed
   * into ~70% of the page and floats to one side.
   *
   * Strategy: hide all chrome (wizard title header, stepper navs,
   * sticky save bar, applicant layout's slim header + floating help),
   * then force every layout container in the ancestor chain to be a
   * full-width block. The article ends up as the only visible element
   * in a clean single-column flow, paginating naturally. */

  /* Hide every <header> and <nav> outside the article (the wizard
   * title row + the stepper sidebar + the slim applicant chrome). */
  body:has(.admission-form) header,
  body:has(.admission-form) nav {
    display: none !important;
  }
  /* Hide sticky / fixed bars (Wizard's auto-save indicator, floating help,
   * Khayameya stripes mounted as separate decorative siblings). */
  body:has(.admission-form) [class*="sticky"],
  body:has(.admission-form) [class*="fixed"] {
    display: none !important;
  }
  /* But keep the PrintLayout article visible even if it has any of
   * those positioning classes. */
  body:has(.admission-form) article[data-print-orientation],
  body:has(.admission-form) article[data-print-orientation] *,
  body:has(.admission-form) .admission-watermark {
    display: revert !important;
  }
  /* Collapse ONLY the wizard's 2-column grid to a single column so
   * the surviving content column fills the page. The wizard uses a
   * unique bracketed Tailwind class with minmax(...); the matching
   * attribute selector below catches it without touching nested
   * grids like the attendance card's grid-cols-[140px_1fr_auto]. */
  body:has(.admission-form) [class*="grid-cols-[minmax"] {
    grid-template-columns: 1fr !important;
    gap: 0 !important;
  }
  /* Strip max-width + padding only on the applicant layout's
   * outer container, not on every max-w element in the tree. */
  body:has(.admission-form) [data-app="applicant"] [class*="max-w-["] {
    max-width: none !important;
    padding: 0 !important;
  }
  body:has(.admission-form) [data-app="applicant"] {
    padding: 0 !important;
    margin: 0 !important;
  }

  /* ── Article = full width, owns its own visible margin via padding. */
  body:has(.admission-form) article[data-print-orientation] {
    width: 100% !important;
    max-width: 100% !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 6mm !important;
    box-sizing: border-box !important;
  }

  .admission-form { padding: 0; }
  .admission-table, .admission-declaration, .admission-signature { break-inside: avoid; }
  .admission-section-heading { break-after: avoid; }
}
`;
