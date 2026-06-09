/**
 * Stage 7 — family data (بيانات العائلة).
 *
 * Sections:
 *   - الأب (1)              | profession + (police/army → membership #)
 *   - زوجات الأب (0..n)    | each with same fields, add/remove
 *   - الأم (1)
 *   - أزواج الأم (0..n)    | each with same fields, add/remove
 *   - الأجداد (4 fixed)    | paternal grandfather/grandmother +
 *                            maternal grandfather/grandmother
 *   - عرض                  | summary + اعتماد (gates exam scheduling)
 *
 * If a member's "متوفي" flag is on, the address fields are shown as
 * "last known residence" — they stay required.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  HelpCircle,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Button,
  Card,
  Field,
  Input,
  SearchSelect,
  Select,
  Tabs,
  Textarea,
  toast,
} from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import {
  EMPTY_GUARDIAN,
  EMPTY_MEMBER,
  DUPLICATE_FAMILY_NATIONAL_ID_MESSAGE,
  formatMemberName,
  HOUSEWIFE_PROFESSION,
  hasDuplicateFamilyNationalId,
  isBirthLocalityRequired,
  PROFESSION_OPTIONS,
  RELATIVE_LABEL,
  canApproveFamilySnapshot,
  saveFamilySnapshot,
  sanitizeFamilyMemberForBirthplace,
  type FamilyDataSnapshot,
  type FamilyMemberForm,
  type GrandparentsForm,
  type GuardianForm,
  type RelativeKind,
} from '../lib/familyData';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { validateParentDob } from '../lib/validateParentDob';
import { applicantPortalService } from '../api/applicantPortal.service';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import { useDraft } from '../api/applicantPortal.queries';
import { useLookup } from '@/features/lookups/api/lookups.queries';
import type { GovernorateRow, PoliceStationRow } from '@/features/lookups';
import {
  policeStationMatchesGovernorate,
  resolveGovernorateRow,
} from '../lib/governorateLookup';
import {
  isStrictNationalId,
  validateNationalIdField,
} from '@/shared/lib/national-id';
import { cn } from '@/shared/lib/cn';

const MEMBERSHIP_PROFESSIONS = new Set(['police_officer', 'army_officer']);
const FEMALE_ONLY_PROFESSIONS = new Set([HOUSEWIFE_PROFESSION]);
type FamilyMemberGender = 'male' | 'female';
type FamilyDraftPatch = Partial<Pick<
  FamilyDataSnapshot,
  'father' | 'mother' | 'fatherWives' | 'motherHusbands' | 'grandparents' | 'relatives' | 'guardian'
>>;

const QUALIFICATION_OPTIONS = [
  { value: '', label: '— اختر —' },
  { value: 'none', label: 'بدون مؤهل' },
  { value: 'primary', label: 'ابتدائي' },
  { value: 'preparatory', label: 'إعدادي' },
  { value: 'secondary', label: 'ثانوي' },
  { value: 'diploma', label: 'دبلوم' },
  { value: 'bachelor', label: 'بكالوريوس / ليسانس' },
  { value: 'masters', label: 'ماجستير' },
  { value: 'phd', label: 'دكتوراه' },
  { value: 'other', label: 'أخرى' },
] as const;

/* Tab keys — `view` was retired as the data-entry page's last tab and
 * moved into a dedicated wizard step (`/applicant/profile/family-review`)
 * per client direction 2026-05-19. */
type TabKey =
  | 'father'
  | 'father-wives'
  | 'mother'
  | 'mother-husbands'
  | 'grandparents'
  | RelativeKind
  | 'guardian';

type FamilySectionStatus = 'complete' | 'missing' | 'optional';

interface FamilySectionNavItem {
  key: TabKey;
  label: string;
  description: string;
  status: FamilySectionStatus;
  count?: number;
  isRequired: boolean;
}

interface FamilySectionNavInput {
  savedFather: boolean;
  savedMother: boolean;
  savedGrandparents: Record<keyof GrandparentsForm, boolean>;
  allGrandparentsSaved: boolean;
  hasFatherWives: boolean;
  fatherWivesOk: boolean;
  fatherWivesCount: number;
  hasMotherHusbands: boolean;
  motherHusbandsOk: boolean;
  motherHusbandsCount: number;
  relatives: Record<RelativeKind, FamilyMemberForm[]>;
  savedRelatives: Record<RelativeKind, boolean[]>;
  guardianOk: boolean;
}

export function Stage7FamilyPage(): JSX.Element {
  const navigate = useNavigate();

  /* Applicant DOB drives the «parent ≥ child + 15y» age-gap rule on
   * every father/mother/stepparent card. Falls back to undefined when
   * the MOI session hasn't loaded — the validator no-ops in that case
   * so the form remains usable. */
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const applicantDob = moiSession?.dateOfBirth;
  const applicantId = moiSession?.applicantId ?? MOI_APPLICANT_SESSION.applicantId;
  const { data: draft } = useDraft(applicantId);

  const [tab, setTab] = useState<TabKey>('father');
  const [father, setFather] = useState<FamilyMemberForm>(EMPTY_MEMBER);
  const [mother, setMother] = useState<FamilyMemberForm>(EMPTY_MEMBER);
  const [fatherWives, setFatherWives] = useState<FamilyMemberForm[]>([]);
  const [motherHusbands, setMotherHusbands] = useState<FamilyMemberForm[]>([]);
  const [grandparents, setGrandparents] = useState<GrandparentsForm>({
    paternalGrandfather: EMPTY_MEMBER,
    paternalGrandmother: EMPTY_MEMBER,
    maternalGrandfather: EMPTY_MEMBER,
    maternalGrandmother: EMPTY_MEMBER,
  });
  /* Incremented once when draft hydration runs — forces every MemberFormCard
   * to remount so its useForm picks up the restored defaultValues. */
  const [formKey, setFormKey] = useState(0);
  const hasHydrated = useRef(false);

  const [savedFather, setSavedFather] = useState(false);
  const [savedMother, setSavedMother] = useState(false);
  /* Per-grandparent saved flags — each card's "حفظ" flips its own key
   * so عرض can show partial progress, and "حفظ الجميع" is enabled when
   * all four are filled (validated by the inner forms). */
  const [savedGrandparents, setSavedGrandparents] = useState<Record<keyof GrandparentsForm, boolean>>({
    paternalGrandfather: false,
    paternalGrandmother: false,
    maternalGrandfather: false,
    maternalGrandmother: false,
  });
  const allGrandparentsSaved =
    savedGrandparents.paternalGrandfather &&
    savedGrandparents.paternalGrandmother &&
    savedGrandparents.maternalGrandfather &&
    savedGrandparents.maternalGrandmother;
  const [savedFatherWives, setSavedFatherWives] = useState<boolean[]>([]);
  const [savedMotherHusbands, setSavedMotherHusbands] = useState<boolean[]>([]);

  /* Relatives — count-driven dynamic cards per kind (الإخوة/الأخوات/
   * الأعمام/العمات/الخالات/الأخوال). Empty = "none of this kind". */
  const [relatives, setRelatives] = useState<Record<RelativeKind, FamilyMemberForm[]>>({
    brothers: [],
    sisters: [],
    paternal_uncles: [],
    paternal_aunts: [],
    maternal_aunts: [],
    maternal_uncles: [],
  });
  const [savedRelatives, setSavedRelatives] = useState<Record<RelativeKind, boolean[]>>({
    brothers: [],
    sisters: [],
    paternal_uncles: [],
    paternal_aunts: [],
    maternal_aunts: [],
    maternal_uncles: [],
  });
  const setRelativeCount = (kind: RelativeKind, next: number): void => {
    const n = Math.max(0, Math.min(20, Math.floor(next || 0)));
    setRelatives((r) => {
      const current = r[kind];
      const sized: FamilyMemberForm[] =
        n > current.length
          ? [...current, ...Array.from({ length: n - current.length }, () => ({ ...EMPTY_MEMBER }))]
          : current.slice(0, n);
      return { ...r, [kind]: sized };
    });
    setSavedRelatives((r) => {
      const current = r[kind];
      const sized: boolean[] =
        n > current.length
          ? [...current, ...Array.from({ length: n - current.length }, () => false)]
          : current.slice(0, n);
      return { ...r, [kind]: sized };
    });
  };

  /* Guardian — ولي الأمر */
  const [guardian, setGuardian] = useState<GuardianForm>(EMPTY_GUARDIAN);
  const [savedGuardian, setSavedGuardian] = useState(false);
  const guardianOk =
    savedGuardian &&
    guardian.firstName.length >= 2 &&
    isStrictNationalId(guardian.nationalId ?? '') &&
    guardian.profession.length > 0 &&
    guardian.qualification.length > 0;

  /* For relatives: a kind is OK if either the count is 0 OR every added
   * card has been saved. */
  const relativesOk = (Object.keys(relatives) as RelativeKind[]).every((k) => {
    const list = savedRelatives[k];
    return list.length === 0 || list.every(Boolean);
  });

  /* Optional sections — the tabs only render when the applicant opts in
   * via the checkboxes on the intro card. When off we clear the entries
   * so a previously-added (but now-hidden) spouse doesn't block "اعتماد". */
  const [hasFatherWives, setHasFatherWives] = useState(false);
  const [hasMotherHusbands, setHasMotherHusbands] = useState(false);

  const toggleHasFatherWives = (next: boolean): void => {
    setHasFatherWives(next);
    if (!next) {
      setFatherWives([]);
      setSavedFatherWives([]);
      if (tab === 'father-wives') setTab('father');
    }
  };
  const toggleHasMotherHusbands = (next: boolean): void => {
    setHasMotherHusbands(next);
    if (!next) {
      setMotherHusbands([]);
      setSavedMotherHusbands([]);
      if (tab === 'mother-husbands') setTab('mother');
    }
  };

  /* Restore family data from the backend draft on first load. Fires once
   * when the draft query resolves and has a `family` block. Incrementing
   * `formKey` forces every MemberFormCard to unmount + remount so their
   * internal useForm picks up the hydrated defaultValues. */
  useEffect(() => {
    if (!draft?.family || hasHydrated.current) return;
    hasHydrated.current = true;

    const f = draft.family as {
      father?: FamilyMemberForm;
      mother?: FamilyMemberForm;
      fatherWives?: FamilyMemberForm[];
      motherHusbands?: FamilyMemberForm[];
      grandparents?: GrandparentsForm;
      relatives?: Record<RelativeKind, FamilyMemberForm[]>;
      guardian?: GuardianForm;
    };

    if (f.father?.firstName) { setFather(f.father); setSavedFather(true); }
    if (f.mother?.firstName) { setMother(f.mother); setSavedMother(true); }
    if (f.fatherWives?.length) {
      setFatherWives(f.fatherWives);
      setSavedFatherWives(f.fatherWives.map(() => true));
      setHasFatherWives(true);
    }
    if (f.motherHusbands?.length) {
      setMotherHusbands(f.motherHusbands);
      setSavedMotherHusbands(f.motherHusbands.map(() => true));
      setHasMotherHusbands(true);
    }
    if (f.grandparents) {
      setGrandparents(f.grandparents);
      setSavedGrandparents({
        paternalGrandfather: !!f.grandparents.paternalGrandfather?.firstName,
        paternalGrandmother: !!f.grandparents.paternalGrandmother?.firstName,
        maternalGrandfather: !!f.grandparents.maternalGrandfather?.firstName,
        maternalGrandmother: !!f.grandparents.maternalGrandmother?.firstName,
      });
    }
    if (f.relatives) {
      setRelatives((prev) => ({ ...prev, ...f.relatives }));
      const restoredSaved: Record<RelativeKind, boolean[]> = {} as Record<RelativeKind, boolean[]>;
      for (const kind of Object.keys(f.relatives) as RelativeKind[]) {
        restoredSaved[kind] = f.relatives[kind].map(() => true);
      }
      setSavedRelatives((prev) => ({ ...prev, ...restoredSaved }));
    }
    if (f.guardian?.firstName) { setGuardian({ ...EMPTY_GUARDIAN, ...f.guardian }); setSavedGuardian(true); }

    setFormKey((k) => k + 1);
  }, [draft]);

  const fatherWivesOk = !hasFatherWives || (
    fatherWives.length > 0 && savedFatherWives.every(Boolean)
  );
  const motherHusbandsOk = !hasMotherHusbands || (
    motherHusbands.length > 0 && savedMotherHusbands.every(Boolean)
  );
  const familySnapshot: FamilyDataSnapshot = {
    father,
    mother,
    fatherWives,
    motherHusbands,
    grandparents,
    relatives,
    guardian,
    savedFather,
    savedMother,
    savedFatherWives,
    savedMotherHusbands,
    savedGrandparents,
    savedRelatives,
    savedGuardian,
    hasFatherWives,
    hasMotherHusbands,
  };
  const duplicateNationalId = hasDuplicateFamilyNationalId(familySnapshot);
  const canApprove =
    fatherWivesOk &&
    motherHusbandsOk &&
    relativesOk &&
    guardianOk &&
    !duplicateNationalId &&
    canApproveFamilySnapshot(familySnapshot);
  const sectionNavItems = buildFamilySectionNavItems({
    savedFather,
    savedMother,
    savedGrandparents,
    allGrandparentsSaved,
    hasFatherWives,
    fatherWivesOk,
    fatherWivesCount: fatherWives.length,
    hasMotherHusbands,
    motherHusbandsOk,
    motherHusbandsCount: motherHusbands.length,
    relatives,
    savedRelatives,
    guardianOk,
  });
  const visibleSectionNavItems = sectionNavItems.filter(
    (item) =>
      item.status !== 'optional' ||
      item.count !== 0 ||
      (item.key !== 'father-wives' && item.key !== 'mother-husbands'),
  );
  const requiredSectionCount = sectionNavItems.filter((item) => item.isRequired).length;
  const completeRequiredSectionCount = sectionNavItems.filter(
    (item) => item.isRequired && item.status === 'complete',
  ).length;
  const completionPercent =
    requiredSectionCount === 0
      ? 0
      : Math.round((completeRequiredSectionCount / requiredSectionCount) * 100);
  const missingRequiredCount = requiredSectionCount - completeRequiredSectionCount;

  /* Snapshot all family state to sessionStorage and persist to the
   * backend, then hand off to the review step for summary + اعتماد. */
  const onContinueToReview = (): void => {
    if (duplicateNationalId) {
      toast(DUPLICATE_FAMILY_NATIONAL_ID_MESSAGE, 'warning');
      return;
    }
    if (!canApprove) {
      toast('أكمل الحقول المطلوبة واحفظ كل بيانات العائلة قبل المتابعة', 'warning');
      return;
    }
    saveFamilySnapshot(familySnapshot);
    void applicantPortalService.saveDraft(applicantId, {
      family: { father, mother, fatherWives, motherHusbands, grandparents, relatives, guardian },
    } as Parameters<typeof applicantPortalService.saveDraft>[1]);
    navigate(ROUTES.applicantFamilyReview);
  };

  /* Persist the complete family snapshot to the backend. Takes an optional
   * per-member override so callers can supply the just-submitted values
   * directly from react-hook-form (bypassing React's async state batching). */
  const persistFamily = (patch: {
    father?: FamilyMemberForm;
    mother?: FamilyMemberForm;
    fatherWives?: FamilyMemberForm[];
    motherHusbands?: FamilyMemberForm[];
    grandparents?: GrandparentsForm;
    relatives?: Record<RelativeKind, FamilyMemberForm[]>;
    guardian?: GuardianForm;
  } = {}): void => {
    void applicantPortalService.saveDraft(applicantId, {
      family: {
        father, mother, fatherWives, motherHusbands, grandparents, relatives, guardian,
        ...patch,
      },
    } as Parameters<typeof applicantPortalService.saveDraft>[1]);
  };
  const rejectDuplicateNationalId = (patch: FamilyDraftPatch): boolean => {
    if (!hasDuplicateFamilyNationalId({ ...familySnapshot, ...patch })) return false;
    toast(DUPLICATE_FAMILY_NATIONAL_ID_MESSAGE, 'warning');
    return true;
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
          <div className="flex items-start gap-3">
            <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Users size={20} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-2xs font-medium text-teal-700">الخطوة الحالية: بيانات العائلة</p>
              <h2 className="font-ar-display text-xl font-bold text-ink-900">بيانات العائلة</h2>
              <p className="mt-1 max-w-[72ch] text-sm leading-normal text-ink-600">
                ابدأ بالوالدين، ثم الأجداد، ثم أضف الأقارب عند وجودهم. احفظ كل بطاقة بعد إدخالها،
                ولن تتمكن من الانتقال للمراجعة إلا بعد اكتمال الأقسام المطلوبة.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-2xs">
                <span className="inline-flex items-center gap-1 rounded-pill bg-teal-50 px-3 py-1 text-teal-700">
                  <CheckCircle2 size={12} strokeWidth={1.75} aria-hidden />
                  {completeRequiredSectionCount} من {requiredSectionCount} أقسام مكتملة
                </span>
                <span className="inline-flex items-center gap-1 rounded-pill bg-gold-50 px-3 py-1 text-gold-700">
                  <HelpCircle size={12} strokeWidth={1.75} aria-hidden />
                  الأقسام الاختيارية تصبح مطلوبة عند إضافة عدد
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border-subtle bg-ink-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xs font-medium text-ink-600">نسبة الاكتمال</span>
              <span className="font-numeric text-lg font-bold text-ink-900">{completionPercent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-pill bg-ink-100">
              <div
                className="h-full rounded-pill bg-teal-500 transition-[width] duration-slow ease-standard"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="mt-2 text-2xs leading-normal text-ink-500">
              {missingRequiredCount === 0
                ? 'جاهز للمراجعة والاعتماد.'
                : `يتبقى ${missingRequiredCount} قسم قبل المراجعة.`}
            </p>
          </div>
        </header>
      </Card>

      <Tabs key={formKey} value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <FamilySectionNavigator
          items={visibleSectionNavItems}
          activeKey={tab}
          onSelect={setTab}
        />

        <Tabs.Panel value="father">
          <MemberFormCard
            form={father}
            title="بيانات الأب"
            gender="male"
            isSaved={savedFather}
            helperText="ابدأ ببيانات الأب كما هي في المستندات الرسمية. الرقم القومي مطلوب لهذا القسم."
            requireNationalId
            childDob={applicantDob}
            onChange={setFather}
            onSave={(values) => {
              if (rejectDuplicateNationalId({ father: values })) return;
              setSavedFather(true);
              persistFamily({ father: values });
              toast('تم حفظ بيانات الأب', 'success');
              setTab(hasFatherWives ? 'father-wives' : 'mother');
            }}
            headerExtras={
              <label className="inline-flex items-center gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-1.5 text-2xs text-gold-700">
                <input
                  type="checkbox"
                  checked={hasFatherWives}
                  onChange={(e) => toggleHasFatherWives(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-teal-500"
                />
                <span>الأب متزوج بأخرى غير الأم</span>
              </label>
            }
          />
        </Tabs.Panel>

        <Tabs.Panel value="father-wives">
          <MultiMemberPanel
            title="زوجات الأب"
            singular="زوجة الأب"
            members={fatherWives}
            savedFlags={savedFatherWives}
            gender="female"
            childDob={applicantDob}
            onAdd={() => {
              setFatherWives((xs) => [...xs, EMPTY_MEMBER]);
              setSavedFatherWives((xs) => [...xs, false]);
            }}
            onChange={(i, next) =>
              setFatherWives((xs) => xs.map((x, idx) => (idx === i ? next : x)))
            }
            onRemove={(i) => {
              setFatherWives((xs) => xs.filter((_, idx) => idx !== i));
              setSavedFatherWives((xs) => xs.filter((_, idx) => idx !== i));
            }}
            onSave={(i, values) => {
              const updated = fatherWives.map((f, idx) => (idx === i ? values : f));
              if (rejectDuplicateNationalId({ fatherWives: updated })) return;
              setSavedFatherWives((xs) => xs.map((s, idx) => (idx === i ? true : s)));
              persistFamily({ fatherWives: updated });
              toast(`تم حفظ بيانات زوجة الأب رقم ${i + 1}`, 'success');
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="mother">
          <MemberFormCard
            form={mother}
            title="بيانات الأم"
            gender="female"
            isSaved={savedMother}
            helperText="أدخل بيانات الأم، ويمكن اختيار «ربة منزل» دون وصف تفصيلي للوظيفة."
            requireNationalId
            isProfessionDetailOptional={(values) => values.profession === HOUSEWIFE_PROFESSION}
            childDob={applicantDob}
            onChange={setMother}
            onSave={(values) => {
              if (rejectDuplicateNationalId({ mother: values })) return;
              setSavedMother(true);
              persistFamily({ mother: values });
              toast('تم حفظ بيانات الأم', 'success');
              setTab(hasMotherHusbands ? 'mother-husbands' : 'grandparents');
            }}
            headerExtras={
              <label className="inline-flex items-center gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-1.5 text-2xs text-gold-700">
                <input
                  type="checkbox"
                  checked={hasMotherHusbands}
                  onChange={(e) => toggleHasMotherHusbands(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-teal-500"
                />
                <span>الأم متزوجة بآخر غير الأب</span>
              </label>
            }
          />
        </Tabs.Panel>

        <Tabs.Panel value="mother-husbands">
          <MultiMemberPanel
            title="أزواج الأم"
            singular="زوج الأم"
            members={motherHusbands}
            savedFlags={savedMotherHusbands}
            gender="male"
            childDob={applicantDob}
            onAdd={() => {
              setMotherHusbands((xs) => [...xs, EMPTY_MEMBER]);
              setSavedMotherHusbands((xs) => [...xs, false]);
            }}
            onChange={(i, next) =>
              setMotherHusbands((xs) => xs.map((x, idx) => (idx === i ? next : x)))
            }
            onRemove={(i) => {
              setMotherHusbands((xs) => xs.filter((_, idx) => idx !== i));
              setSavedMotherHusbands((xs) => xs.filter((_, idx) => idx !== i));
            }}
            onSave={(i, values) => {
              const updated = motherHusbands.map((m, idx) => (idx === i ? values : m));
              if (rejectDuplicateNationalId({ motherHusbands: updated })) return;
              setSavedMotherHusbands((xs) => xs.map((s, idx) => (idx === i ? true : s)));
              persistFamily({ motherHusbands: updated });
              toast(`تم حفظ بيانات زوج الأم رقم ${i + 1}`, 'success');
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="grandparents">
          <GrandparentsPanel
            value={grandparents}
            savedFlags={savedGrandparents}
            fatherDob={father.dateOfBirth}
            motherDob={mother.dateOfBirth}
            onChange={setGrandparents}
            onSaveOne={(key, values) => {
              const updated = { ...grandparents, [key]: values };
              if (rejectDuplicateNationalId({ grandparents: updated })) return;
              setSavedGrandparents((s) => ({ ...s, [key]: true }));
              persistFamily({ grandparents: updated });
              toast('تم حفظ البيانات', 'success');
            }}
            onSaveAll={() => {
              if (rejectDuplicateNationalId({ grandparents })) return;
              setSavedGrandparents({
                paternalGrandfather: true,
                paternalGrandmother: true,
                maternalGrandfather: true,
                maternalGrandmother: true,
              });
              persistFamily();
              toast('تم حفظ بيانات الأجداد', 'success');
              setTab('brothers');
            }}
          />
        </Tabs.Panel>

        {(Object.keys(RELATIVE_LABEL) as RelativeKind[]).map((kind) => (
          <Tabs.Panel key={kind} value={kind}>
            <DynamicRelativePanel
              kind={kind}
              members={relatives[kind]}
              savedFlags={savedRelatives[kind]}
              onSetCount={(n) => setRelativeCount(kind, n)}
              onChange={(i, next) =>
                setRelatives((r) => ({
                  ...r,
                  [kind]: r[kind].map((x, idx) => (idx === i ? next : x)),
                }))
              }
              onSave={(i, values) => {
                const updated = relatives[kind].map((m, idx) => (idx === i ? values : m));
                const nextRelatives = { ...relatives, [kind]: updated };
                if (rejectDuplicateNationalId({ relatives: nextRelatives })) return;
                setSavedRelatives((s) => ({
                  ...s,
                  [kind]: s[kind].map((v, idx) => (idx === i ? true : v)),
                }));
                persistFamily({ relatives: nextRelatives });
                toast('تم حفظ البيانات', 'success');
              }}
            />
          </Tabs.Panel>
        ))}

        <Tabs.Panel value="guardian">
          <GuardianFormCard
            value={guardian}
            isSaved={savedGuardian}
            onChange={setGuardian}
            familyMemberOptions={buildGuardianFamilyMemberOptions({
              father,
              mother,
              fatherWives,
              motherHusbands,
              grandparents,
              relatives,
            })}
            onSave={(values) => {
              if (rejectDuplicateNationalId({ guardian: values })) return;
              setSavedGuardian(true);
              persistFamily({ guardian: values });
              toast('تم حفظ بيانات ولي الأمر', 'success');
            }}
          />
        </Tabs.Panel>
      </Tabs>

      {/* Footer CTA — the current page owns the completeness gate before
          the dedicated review + اعتماد step. */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-ar-display text-md font-bold text-ink-900">
              الانتقال لمراجعة بيانات العائلة
            </h3>
            <p className="mt-1 text-2xs text-ink-500">
              {canApprove
                ? 'كل البيانات مكتملة — انتقل لعرض الملخّص والاعتماد.'
                : duplicateNationalId
                  ? DUPLICATE_FAMILY_NATIONAL_ID_MESSAGE
                : 'أكمل الأقسام التي تظهر بحالة «ناقص» واحفظها قبل الانتقال للمراجعة.'}
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={onContinueToReview}
            trailingIcon={<ArrowRight size={16} strokeWidth={1.75} />}
            disabled={!canApprove}
          >
            متابعة للمراجعة
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ─── Reusable single-member form ──────────────────────────────────── */

function MemberFormCard({
  form,
  title,
  onChange,
  onSave,
  headerExtras,
  gender,
  requireNationalId = false,
  isSaved = false,
  helperText,
  isProfessionDetailOptional,
  childDob,
}: {
  form: FamilyMemberForm;
  title: string;
  onChange: (next: FamilyMemberForm) => void;
  onSave: (values: FamilyMemberForm) => void;
  /** Optional content rendered inside the card header (used by الأب /
   *  الأم cards to host their "متزوج بأخرى" / "متزوجة بغير الأب"
   *  toggles). */
  headerExtras?: React.ReactNode;
  gender?: FamilyMemberGender;
  /** When true, the "تعذر وجود الرقم القومي" escape hatch is removed —
   *  the applicant must enter a 14-digit NID. Used for الأب + الأم per
   *  client direction 2026-05-21 (parents' NIDs are mandatory). */
  requireNationalId?: boolean;
  /** Displays the saved/missing badge in the card header. */
  isSaved?: boolean;
  /** Short guidance rendered under the title for high-stakes member cards. */
  helperText?: string;
  /** Optional escape hatch for role-specific profession details, e.g.
   *  mother's "ربة منزل" does not require a job-details description. */
  isProfessionDetailOptional?: (values: FamilyMemberForm) => boolean;
  /** ISO yyyy-mm-dd of the *child* this member is a parent of. When set,
   *  the DOB input enforces the 15-year minimum age gap. Validator
   *  no-ops if either side is empty (filling order isn't constrained). */
  childDob?: string;
}): JSX.Element {
  const form_ = useForm<FamilyMemberForm>({
    defaultValues: form,
  });
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = form_;
  const profession = watch('profession');
  const professionDetailOptional = isProfessionDetailOptional?.(watch()) ?? false;
  const professionOptions = useMemo(
    () => PROFESSION_OPTIONS.filter(
      (option) => gender !== 'male' || !FEMALE_ONLY_PROFESSIONS.has(option.value),
    ),
    [gender],
  );
  const birthGov = watch('birthGovernorate');
  const residenceGov = watch('residenceGovernorate');
  const nidUnavailableReason = watch('nidUnavailableReason');
  /* When requireNationalId is on, ignore any stale `nidUnavailable=true`
   * the form may have carried over from a different role and treat the
   * NID input as always-visible / always-required. */
  const nidUnavailable = requireNationalId ? false : watch('nidUnavailable');
  const birthLocalityRequired = isBirthLocalityRequired({
    nidUnavailable,
    nidUnavailableReason,
  });
  const showSeniority = MEMBERSHIP_PROFESSIONS.has(profession);

  /* Lookup-backed governorate + police-station data. TanStack Query caches
   * these so multiple MemberFormCard instances don't trigger extra fetches. */
  const governoratesQuery = useLookup('governorates');
  const policeStationsQuery = useLookup('police-stations');

  const govOptions = useMemo<SearchSelectOption[]>(
    () => (governoratesQuery.data ?? [])
      .filter((g: GovernorateRow) => g.isActive)
      .map((g: GovernorateRow) => ({ value: g.name, label: g.name })),
    [governoratesQuery.data],
  );
  const birthGovernorateRow = useMemo(
    () => resolveGovernorateRow(governoratesQuery.data ?? [], birthGov),
    [governoratesQuery.data, birthGov],
  );
  const residenceGovernorateRow = useMemo(
    () => resolveGovernorateRow(governoratesQuery.data ?? [], residenceGov),
    [governoratesQuery.data, residenceGov],
  );

  const birthDistrictOptions = useMemo<SearchSelectOption[]>(() => {
    if (!birthGovernorateRow) return [];
    return (policeStationsQuery.data ?? [])
      .filter(
        (ps: PoliceStationRow) =>
          ps.isActive && policeStationMatchesGovernorate(ps, birthGovernorateRow),
      )
      .map((ps: PoliceStationRow) => ({ value: ps.name, label: ps.name }));
  }, [birthGovernorateRow, policeStationsQuery.data]);

  const residenceDistrictOptions = useMemo<SearchSelectOption[]>(() => {
    if (!residenceGovernorateRow) return [];
    return (policeStationsQuery.data ?? [])
      .filter(
        (ps: PoliceStationRow) =>
          ps.isActive && policeStationMatchesGovernorate(ps, residenceGovernorateRow),
      )
      .map((ps: PoliceStationRow) => ({ value: ps.name, label: ps.name }));
  }, [residenceGovernorateRow, policeStationsQuery.data]);

  /* Reset district when governorate changes so stale values don't persist.
   * Mount guards skip the first run so hydrated district values are preserved. */
  const birthGovMounted = useRef(false);
  const residenceGovMounted = useRef(false);
  useEffect(() => {
    if (!birthGovMounted.current) { birthGovMounted.current = true; return; }
    setValue('birthDistrict', '');
  }, [birthGov, setValue]);
  useEffect(() => {
    if (birthLocalityRequired) return;
    setValue('birthGovernorate', '');
    setValue('birthDistrict', '');
  }, [birthLocalityRequired, setValue]);
  useEffect(() => {
    if (gender !== 'male' || !FEMALE_ONLY_PROFESSIONS.has(profession)) return;
    setValue('profession', '');
    setValue('professionDetail', '');
  }, [gender, profession, setValue]);
  useEffect(() => {
    if (!residenceGovMounted.current) { residenceGovMounted.current = true; return; }
    setValue('residenceDistrict', '');
  }, [residenceGov, setValue]);

  /* Stream live values to the parent so consumers like
   * GrandparentsPanel's "حفظ الجميع" can compute allFilled without
   * waiting for the inner submit. */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const sub = form_.watch((vals) => {
      onChangeRef.current(vals as FamilyMemberForm);
    });
    return () => sub.unsubscribe();
  }, [form_]);

  const submit = handleSubmit((values) => {
    const normalized = sanitizeFamilyMemberForBirthplace({
      ...values,
      nidUnavailable,
    });
    onChange(normalized);
    onSave(normalized);
  });

  return (
    <Card>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span aria-hidden className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Users size={14} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-ar-display text-md font-bold text-ink-900">{title}</h3>
              <SaveStatusBadge isSaved={isSaved} />
            </div>
            {helperText && (
              <p className="mt-0.5 max-w-[68ch] text-2xs leading-normal text-ink-500">
                {helperText}
              </p>
            )}
          </div>
        </div>
        {headerExtras}
      </header>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        {/* Split-name block — client direction 2026-05-21. Three Inputs
            replace the previous single "الاسم" field. Rendered as a
            nested 3-col sub-grid that spans the parent form width so all
            three parts sit on one row on desktop. */}
        <div className="grid gap-3 sm:grid-cols-3 md:col-span-2">
          <Input
            label="الاسم الأول"
            required
            {...register('firstName', { required: 'مطلوب', minLength: { value: 2, message: 'مطلوب' } })}
            error={errors.firstName?.message}
          />
          <Input
            label="الاسم الثاني"
            required
            {...register('secondName', { required: 'مطلوب', minLength: { value: 2, message: 'مطلوب' } })}
            error={errors.secondName?.message}
          />
          <Input
            label="الاسم الثالث"
            required
            {...register('thirdName', { required: 'مطلوب', minLength: { value: 2, message: 'مطلوب' } })}
            error={errors.thirdName?.message}
          />
        </div>

        {/* NID block — checkbox toggles between NID input and reason
            dropdown. For الأب + الأم the toggle is hidden entirely:
            their NID is mandatory per client direction 2026-05-21. */}
        {!requireNationalId && (
          <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              {...register('nidUnavailable')}
              className="h-4 w-4 cursor-pointer accent-teal-500"
            />
            تعذر وجود الرقم القومي
          </label>
        )}
        {nidUnavailable ? (
          <Select
            label="سبب عدم وجود الرقم القومي"
            required
            {...register('nidUnavailableReason', { required: 'مطلوب' })}
            options={[
              { value: '', label: '— اختر —' },
              { value: 'fallen_record', label: 'ساقط قيد' },
              { value: 'born_abroad', label: 'مواليد الخارج' },
            ]}
            error={errors.nidUnavailableReason?.message as string | undefined}
            containerClassName="md:col-span-2"
          />
        ) : (
          <Input
            label="الرقم القومي"
            required
            dir="ltr"
            placeholder="14 رقماً"
            maxLength={14}
            {...register('nationalId', {
              validate: (v: string) => {
                if (nidUnavailable) return true;
                return validateNationalIdField(v);
              },
            })}
            error={errors.nationalId?.message}
            containerClassName="md:col-span-2"
          />
        )}

        <Select
          label="الديانة"
          required
          {...register('religion')}
          options={[
            { value: 'مسلم', label: 'مسلم' },
            { value: 'مسيحي', label: 'مسيحي' },
          ]}
        />
        <Input
          label="تاريخ الميلاد"
          type="date"
          required
          {...register('dateOfBirth', {
            required: 'مطلوب',
            validate: (v: string) => validateParentDob(v, childDob),
          })}
          error={errors.dateOfBirth?.message}
        />
        {birthLocalityRequired && (
          <>
            <Field label="محافظة الميلاد" required error={errors.birthGovernorate?.message}>
              <Controller
                control={control}
                name="birthGovernorate"
                rules={{ required: 'مطلوب' }}
                render={({ field }) => (
                  <SearchSelect
                    ariaLabel="محافظة الميلاد"
                    placeholder="اختر المحافظة"
                    options={govOptions}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? '')}
                  />
                )}
              />
            </Field>
            <Field label="قسم / مركز الميلاد" required error={errors.birthDistrict?.message}>
              <Controller
                control={control}
                name="birthDistrict"
                rules={{ required: 'مطلوب' }}
                render={({ field }) => (
                  <SearchSelect
                    ariaLabel="قسم / مركز الميلاد"
                    placeholder={birthGov ? 'اختر القسم أو المركز' : 'اختر المحافظة أولاً'}
                    options={birthDistrictOptions}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? '')}
                    disabled={!birthGov}
                  />
                )}
              />
            </Field>
          </>
        )}

        {/* Profession + qualification block */}
        <Select
          label="المهنة"
          required
          {...register('profession', { required: 'مطلوب' })}
          options={[...professionOptions]}
          error={errors.profession?.message}
        />
        {showSeniority && (
          <Input
            label="رقم الأقدمية"
            required
            type="text"
            dir="ltr"
            {...register('seniorityNumber', { required: 'مطلوب' })}
            error={errors.seniorityNumber?.message}
          />
        )}
        <Select
          label="المؤهل"
          required
          {...register('qualification', { required: 'مطلوب' })}
          options={[...QUALIFICATION_OPTIONS]}
          error={errors.qualification?.message}
        />
        <Textarea
          label="وصف تفصيلي للوظيفة"
          rows={2}
          required={!professionDetailOptional}
          disabled={professionDetailOptional}
          {...register('professionDetail', {
            validate: (value: string | undefined, values: FamilyMemberForm) =>
              isProfessionDetailOptional?.(values) || (value ?? '').trim().length > 0 || 'مطلوب',
          })}
          error={errors.professionDetail?.message}
          containerClassName="md:col-span-2"
        />
        <Textarea
          label="وصف تفصيلي للمؤهل"
          rows={2}
          required
          {...register('qualificationDetail', {
            validate: (v: string) => v.trim().length > 0 || 'مطلوب',
          })}
          error={errors.qualificationDetail?.message}
          containerClassName="md:col-span-2"
        />

        {/* Residence block — always shown (even for deceased members,
            who carry their last known residence). */}
        <Field label="محافظة الإقامة" required error={errors.residenceGovernorate?.message}>
          <Controller
            control={control}
            name="residenceGovernorate"
            rules={{ required: 'مطلوب' }}
            render={({ field }) => (
              <SearchSelect
                ariaLabel="محافظة الإقامة"
                placeholder="اختر المحافظة"
                options={govOptions}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? '')}
              />
            )}
          />
        </Field>
        <Field label="قسم / مركز الإقامة" required error={errors.residenceDistrict?.message}>
          <Controller
            control={control}
            name="residenceDistrict"
            rules={{ required: 'مطلوب' }}
            render={({ field }) => (
              <SearchSelect
                ariaLabel="قسم / مركز الإقامة"
                placeholder={residenceGov ? 'اختر القسم أو المركز' : 'اختر المحافظة أولاً'}
                options={residenceDistrictOptions}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? '')}
                disabled={!residenceGov}
              />
            )}
          />
        </Field>
        <Textarea
          label="تفصيلي عنوان الإقامة"
          rows={2}
          required
          {...register('residenceDetail', {
            required: 'مطلوب',
            minLength: { value: 5, message: 'مطلوب' },
          })}
          error={errors.residenceDetail?.message}
          containerClassName="md:col-span-2"
        />

        {/* متوفي — moved to the END per client direction 2026-05-19. */}
        <label className="md:col-span-2 mt-1 inline-flex items-center gap-2 rounded-md border border-border-default bg-ink-50 px-3 py-2 text-sm text-ink-800">
          <input
            type="checkbox"
            {...register('deceased')}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          متوفي
        </label>

        <div className="md:col-span-2 flex justify-end pt-1">
          <Button type="submit" variant="primary">
            حفظ
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ─── Multi-member (wives / husbands) panel ────────────────────────── */

function MultiMemberPanel({
  title,
  singular,
  members,
  savedFlags,
  gender,
  childDob,
  onAdd,
  onChange,
  onRemove,
  onSave,
}: {
  title: string;
  singular: string;
  members: readonly FamilyMemberForm[];
  savedFlags: readonly boolean[];
  gender: FamilyMemberGender;
  /** Forwarded to each MemberFormCard so stepmother/stepfather entries
   *  enforce the 15-year-older-than-applicant rule. */
  childDob?: string;
  onAdd: () => void;
  onChange: (i: number, next: FamilyMemberForm) => void;
  onRemove: (i: number) => void;
  onSave: (i: number, values: FamilyMemberForm) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-ar-display text-md font-bold text-ink-900">{title}</h3>
            <p className="mt-1 text-2xs text-ink-500 leading-normal">
              أضف بيانات كل {singular} على حدة. التبويب يُعدّ مكتملاً عند حفظ جميع المُدخَلات
              أو ترك القائمة فارغة.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon={<Plus size={13} strokeWidth={1.75} />}
            onClick={onAdd}
          >
            إضافة {singular}
          </Button>
        </header>
        {members.length === 0 && (
          <p className="mt-3 rounded-md border border-dashed border-ink-200 bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
            لا توجد إضافات حالياً. اتركها فارغة إذا لم تنطبق.
          </p>
        )}
      </Card>
      {members.map((m, i) => (
        <div key={i} className="relative">
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`حذف ${singular} رقم ${i + 1}`}
            className="absolute -top-2 end-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-default bg-surface-card text-terra-600 shadow-sm hover:border-terra-400 hover:bg-terra-50"
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
          <MemberFormCard
            form={m}
            title={`${singular} رقم ${i + 1}`}
            gender={gender}
            isSaved={Boolean(savedFlags[i])}
            helperText="احفظ هذه البطاقة قبل الانتقال. يمكنك حذفها إذا أضيفت بالخطأ."
            childDob={childDob}
            onChange={(next) => onChange(i, next)}
            onSave={(values) => onSave(i, values)}
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Dynamic count-driven relatives panel ────────────────────────── */

function DynamicRelativePanel({
  kind,
  members,
  savedFlags,
  onSetCount,
  onChange,
  onSave,
}: {
  kind: RelativeKind;
  members: readonly FamilyMemberForm[];
  savedFlags: readonly boolean[];
  onSetCount: (n: number) => void;
  onChange: (i: number, next: FamilyMemberForm) => void;
  onSave: (i: number, values: FamilyMemberForm) => void;
}): JSX.Element {
  const label = RELATIVE_LABEL[kind];
  const gender = genderByRelativeKind(kind);
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <header className="mb-2">
          <h3 className="font-ar-display text-md font-bold text-ink-900">
            بيانات {label.plural}
          </h3>
          <p className="mt-1 text-2xs text-ink-500 leading-normal">
            أدخل عدد {label.plural} أولاً، ثم سيظهر لكل واحدٍ كرت بياناته. اترك العدد
            صفراً إذا لم يوجد.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <Input
            label={`عدد ${label.plural}`}
            type="number"
            min={0}
            max={20}
            dir="ltr"
            value={members.length}
            onChange={(e) => onSetCount(Number(e.target.value))}
          />
        </div>
      </Card>
      {members.map((m, i) => (
        <div key={i} className="relative">
          <MemberFormCard
            form={m}
            title={`${label.singular} رقم ${i + 1}`}
            gender={gender}
            isSaved={Boolean(savedFlags[i])}
            helperText="هذه البطاقة مطلوبة لأنك أدخلت عدداً لهذا القسم."
            onChange={(next) => onChange(i, next)}
            onSave={(values) => onSave(i, values)}
          />
        </div>
      ))}
    </div>
  );
}

function genderByRelativeKind(kind: RelativeKind): FamilyMemberGender {
  return kind === 'brothers' || kind === 'paternal_uncles' || kind === 'maternal_uncles'
    ? 'male'
    : 'female';
}

/* ─── Guardian form (ولي الأمر) ────────────────────────────────────── */

/* Build the "اختر ولي الأمر من أفراد الأسرة" picker options from every
 * family-member slot the applicant has filled — father, mother,
 * stepparents, grandparents, and the six relative kinds. */
interface GuardianMemberOption {
  /** Stable key — used as the <select> value + as the lookup key
   *  inside the GuardianFormCard reset handler. */
  value: string;
  /** Display label: "<relation> — <full name>" so the user sees who
   *  they're selecting at a glance. */
  label: string;
  /** Direct reference to the FamilyMemberForm we'll copy from. */
  member: FamilyMemberForm;
}

function buildGuardianFamilyMemberOptions(input: {
  father: FamilyMemberForm;
  mother: FamilyMemberForm;
  fatherWives: FamilyMemberForm[];
  motherHusbands: FamilyMemberForm[];
  grandparents: GrandparentsForm;
  relatives: Record<RelativeKind, FamilyMemberForm[]>;
}): GuardianMemberOption[] {
  const opts: GuardianMemberOption[] = [];
  const pushIfNamed = (key: string, label: string, m: FamilyMemberForm): void => {
    const name = formatMemberName(m);
    if (name === '—' || name.trim().length === 0) return;
    opts.push({ value: key, label: `${label} — ${name}`, member: m });
  };

  pushIfNamed('father', 'الأب', input.father);
  pushIfNamed('mother', 'الأم', input.mother);
  input.fatherWives.forEach((m, i) => pushIfNamed(`fatherWife-${i}`, `زوجة الأب ${i + 1}`, m));
  input.motherHusbands.forEach((m, i) => pushIfNamed(`motherHusband-${i}`, `زوج الأم ${i + 1}`, m));
  pushIfNamed('paternalGrandfather', 'الجد لأب', input.grandparents.paternalGrandfather);
  pushIfNamed('paternalGrandmother', 'الجدة لأب', input.grandparents.paternalGrandmother);
  pushIfNamed('maternalGrandfather', 'الجد لأم', input.grandparents.maternalGrandfather);
  pushIfNamed('maternalGrandmother', 'الجدة لأم', input.grandparents.maternalGrandmother);
  (Object.keys(input.relatives) as RelativeKind[]).forEach((kind) => {
    input.relatives[kind].forEach((m, i) => {
      pushIfNamed(`relative-${kind}-${i}`, `${RELATIVE_LABEL[kind].singular} ${i + 1}`, m);
    });
  });
  return opts;
}

/** Map a FamilyMemberForm into the GuardianForm shape — copies the
 * fields the two records share. The textarea/details fields fall
 * back to empty strings when the source doesn't carry them. */
function familyMemberToGuardian(m: FamilyMemberForm): GuardianForm {
  return {
    firstName: m.firstName,
    secondName: m.secondName,
    thirdName: m.thirdName,
    nationalId: m.nationalId,
    profession: m.profession,
    seniorityNumber: m.seniorityNumber ?? '',
    qualification: m.qualification,
    qualificationDetail: m.qualificationDetail ?? '',
    professionDetail: m.professionDetail ?? '',
    workplaceDetail: '',
  };
}

function GuardianFormCard({
  value,
  isSaved,
  onChange,
  onSave,
  familyMemberOptions,
}: {
  value: GuardianForm;
  isSaved: boolean;
  onChange: (next: GuardianForm) => void;
  onSave: (values: GuardianForm) => void;
  familyMemberOptions: GuardianMemberOption[];
}): JSX.Element {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<GuardianForm>({
    defaultValues: value,
  });
  const guardianProfession = watch('profession');
  const showGuardianSeniority = MEMBERSHIP_PROFESSIONS.has(guardianProfession);
  /* Stream live values to the parent so the summary tab reflects edits
   * before the explicit حفظ click. */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const sub = watch((vals) => onChangeRef.current(vals as GuardianForm));
    return () => sub.unsubscribe();
  }, [watch]);

  /* Guardian-source picker — transient UI state, not stored. When the
   * applicant picks a family member, copy that member's data into the
   * form via reset() (form internals stay in sync) → the streaming
   * watch() above propagates to the parent state. Picking «آخر» just
   * leaves the form alone for manual editing. */
  const [guardianSource, setGuardianSource] = useState<string>('');
  const handleSourceChange = (next: string): void => {
    setGuardianSource(next);
    if (!next || next === 'manual') return;
    const opt = familyMemberOptions.find((o) => o.value === next);
    if (!opt) return;
    const mapped = familyMemberToGuardian(opt.member);
    reset(mapped);
    onChange(mapped);
  };
  /* When the source is a family member, dim the form fields so the
   * applicant can't edit derived data. Clearing the lock requires
   * switching the picker back to «آخر — إدخال البيانات يدوياً». */
  const guardianLocked = guardianSource !== '' && guardianSource !== 'manual';

  const submit = handleSubmit((vals) => {
    onChange(vals);
    onSave(vals);
  });
  return (
    <Card>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span aria-hidden className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <ShieldCheck size={14} strokeWidth={1.75} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-ar-display text-md font-bold text-ink-900">تحديد ولي الأمر</h3>
              <SaveStatusBadge isSaved={isSaved} />
            </div>
            <p className="mt-0.5 text-2xs leading-normal text-ink-500">
              اختر ولي الأمر من فرد عائلة محفوظ أو أدخل بياناته يدوياً.
            </p>
          </div>
        </div>
      </header>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        {/* Guardian-source picker — copy from an existing family member
            already added in this page, or pick «آخر» to enter manually. */}
        <div className="md:col-span-2">
          <Select
            label="اختيار ولي الأمر"
            required
            value={guardianSource}
            onChange={(e) => handleSourceChange(e.target.value)}
            options={[
              { value: '', label: '— اختر —' },
              ...familyMemberOptions.map((o) => ({ value: o.value, label: o.label })),
              { value: 'manual', label: 'آخر — إدخال البيانات يدوياً' },
            ]}
          />
          <p className="mt-1 text-2xs text-ink-500 leading-relaxed">
            {familyMemberOptions.length === 0
              ? 'لم تُسجَّل بيانات عائلة أخرى بعد — يمكنك إدخال بيانات ولي الأمر يدوياً.'
              : 'اختيار أحد أفراد الأسرة يملأ الحقول التالية تلقائياً، ويمكنك تعديلها بعد ذلك.'}
          </p>
        </div>

        {/* Split-name block — client direction 2026-05-21. Three Inputs
            replace the previous single "الاسم" field. Rendered as a
            nested 3-col sub-grid that spans the parent form width so all
            three parts sit on one row on desktop. */}
        <div className="grid gap-3 sm:grid-cols-3 md:col-span-2">
          <Input
            label="الاسم الأول"
            required
            disabled={guardianLocked}
            {...register('firstName', { required: 'مطلوب', minLength: { value: 2, message: 'مطلوب' } })}
            error={errors.firstName?.message}
          />
          <Input
            label="الاسم الثاني"
            required
            disabled={guardianLocked}
            {...register('secondName', { required: 'مطلوب', minLength: { value: 2, message: 'مطلوب' } })}
            error={errors.secondName?.message}
          />
          <Input
            label="الاسم الثالث"
            required
            disabled={guardianLocked}
            {...register('thirdName', { required: 'مطلوب', minLength: { value: 2, message: 'مطلوب' } })}
            error={errors.thirdName?.message}
          />
        </div>
        <Input
          label="الرقم القومي"
          required
          dir="ltr"
          placeholder="14 رقماً"
          maxLength={14}
          disabled={guardianLocked}
          {...register('nationalId', { validate: validateNationalIdField })}
          error={errors.nationalId?.message}
          containerClassName="md:col-span-2"
        />
        <Select
          label="الوظيفة"
          required
          disabled={guardianLocked}
          {...register('profession', { required: 'مطلوب' })}
          options={[...PROFESSION_OPTIONS]}
          error={errors.profession?.message}
        />
        {showGuardianSeniority && (
          <Input
            label="رقم الأقدمية"
            required
            type="text"
            dir="ltr"
            disabled={guardianLocked}
            {...register('seniorityNumber', { required: 'مطلوب' })}
            error={errors.seniorityNumber?.message}
          />
        )}
        <Select
          label="المؤهل"
          required
          disabled={guardianLocked}
          {...register('qualification', { required: 'مطلوب' })}
          options={[...QUALIFICATION_OPTIONS]}
          error={errors.qualification?.message}
        />
        <Textarea
          label="وصف تفصيلي للمؤهل"
          rows={2}
          disabled={guardianLocked}
          {...register('qualificationDetail')}
          error={errors.qualificationDetail?.message}
          containerClassName="md:col-span-2"
        />
        <Textarea
          label="وصف تفصيلي للوظيفة"
          rows={2}
          disabled={guardianLocked}
          {...register('professionDetail')}
          error={errors.professionDetail?.message}
          containerClassName="md:col-span-2"
        />
        <Textarea
          label="بيانات جهة العمل / الوظيفة"
          rows={2}
          disabled={guardianLocked}
          {...register('workplaceDetail')}
          error={errors.workplaceDetail?.message}
          containerClassName="md:col-span-2"
        />
        <div className="md:col-span-2 flex justify-end pt-1">
          <Button type="submit" variant="primary">حفظ</Button>
        </div>
      </form>
    </Card>
  );
}

/* ─── Grandparents panel — 4 fixed members ─────────────────────────── */

function GrandparentsPanel({
  value,
  savedFlags,
  fatherDob,
  motherDob,
  onChange,
  onSaveOne,
  onSaveAll,
}: {
  value: GrandparentsForm;
  savedFlags: Record<keyof GrandparentsForm, boolean>;
  /** Father's DOB drives the 15-year age-gap rule for paternal
   *  grandparents; mother's DOB drives the maternal side. Undefined
   *  values disable the check (validator no-ops). */
  fatherDob?: string;
  motherDob?: string;
  onChange: (next: GrandparentsForm) => void;
  onSaveOne: (key: keyof GrandparentsForm, values: FamilyMemberForm) => void;
  onSaveAll: () => void;
}): JSX.Element {
  /* Per-card "حفظ" propagates the new values to the parent AND flips
   * that grandparent's saved flag so عرض updates immediately. "حفظ
   * الجميع" sets all four flags + advances to the view tab. */
  const updateOne = <K extends keyof GrandparentsForm>(
    key: K,
    next: FamilyMemberForm,
  ): void => {
    onChange({ ...value, [key]: next });
  };

  const allFilled =
    isFilled(value.paternalGrandfather) &&
    isFilled(value.paternalGrandmother) &&
    isFilled(value.maternalGrandfather) &&
    isFilled(value.maternalGrandmother);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <header>
          <h3 className="font-ar-display text-md font-bold text-ink-900">الأجداد</h3>
          <p className="mt-1 text-2xs text-ink-500 leading-normal">
            أدخل بيانات الجدّ والجدّة من جهة الأب والأم. كل الحقول مطلوبة.
          </p>
        </header>
      </Card>
      <MemberFormCard
        form={value.paternalGrandfather}
        title="الجد لأب"
        gender="male"
        isSaved={savedFlags.paternalGrandfather}
        childDob={fatherDob}
        onChange={(next) => updateOne('paternalGrandfather', next)}
        onSave={(values) => onSaveOne('paternalGrandfather', values)}
      />
      <MemberFormCard
        form={value.paternalGrandmother}
        title="الجدة لأب"
        gender="female"
        isSaved={savedFlags.paternalGrandmother}
        childDob={fatherDob}
        onChange={(next) => updateOne('paternalGrandmother', next)}
        onSave={(values) => onSaveOne('paternalGrandmother', values)}
      />
      <MemberFormCard
        form={value.maternalGrandfather}
        title="الجد لأم"
        gender="male"
        isSaved={savedFlags.maternalGrandfather}
        childDob={motherDob}
        onChange={(next) => updateOne('maternalGrandfather', next)}
        onSave={(values) => onSaveOne('maternalGrandfather', values)}
      />
      <MemberFormCard
        form={value.maternalGrandmother}
        title="الجدة لأم"
        gender="female"
        isSaved={savedFlags.maternalGrandmother}
        childDob={motherDob}
        onChange={(next) => updateOne('maternalGrandmother', next)}
        onSave={(values) => onSaveOne('maternalGrandmother', values)}
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xs text-ink-500">
            اضغط «حفظ الجميع» بعد ملء الحقول الأربعة (أو احفظ كل بطاقة على حدة).
          </p>
          <Button
            variant="primary"
            disabled={!allFilled}
            onClick={onSaveAll}
            leadingIcon={<Check size={14} strokeWidth={1.75} />}
          >
            حفظ الجميع
          </Button>
        </div>
      </Card>
    </div>
  );
}

function isFilled(m: FamilyMemberForm): boolean {
  const birthLocalityOk =
    !isBirthLocalityRequired(m) ||
    (m.birthGovernorate.length > 0 && m.birthDistrict.length > 0);
  const baseOk =
    m.firstName.length >= 2 &&
    (m.nidUnavailable
      ? m.nidUnavailableReason.length > 0
      : isStrictNationalId(m.nationalId)) &&
    m.dateOfBirth.length > 0 &&
    birthLocalityOk &&
    m.profession.length > 0 &&
    m.qualification.length > 0 &&
    m.professionDetail.trim().length > 0 &&
    m.qualificationDetail.trim().length > 0 &&
    (!MEMBERSHIP_PROFESSIONS.has(m.profession) || (m.seniorityNumber ?? '').length > 0);
  if (!baseOk) return false;
  /* Residence is now required for every member (even deceased — last
   * known address). */
  return (
    m.residenceGovernorate.length > 0 &&
    m.residenceDistrict.length > 0 &&
    m.residenceDetail.length >= 5
  );
}

/* ─── small helpers ──────────────────────────────────────────────── */

function buildFamilySectionNavItems(input: FamilySectionNavInput): FamilySectionNavItem[] {
  return [
    ...requiredFamilySectionNavItems(input),
    ...optionalParentSpouseNavItems(input),
    ...relativeFamilySectionNavItems(input),
    {
      key: 'guardian',
      label: 'ولي الأمر',
      description: 'مطلوب قبل المراجعة',
      status: input.guardianOk ? 'complete' : 'missing',
      isRequired: true,
    },
  ];
}

function requiredFamilySectionNavItems(input: FamilySectionNavInput): FamilySectionNavItem[] {
  return [
    {
      key: 'father',
      label: 'الأب',
      description: 'بيانات أساسية',
      status: input.savedFather ? 'complete' : 'missing',
      isRequired: true,
    },
    {
      key: 'mother',
      label: 'الأم',
      description: 'بيانات أساسية',
      status: input.savedMother ? 'complete' : 'missing',
      isRequired: true,
    },
    {
      key: 'grandparents',
      label: 'الأجداد',
      description: '٤ بطاقات مطلوبة',
      status: input.allGrandparentsSaved ? 'complete' : 'missing',
      count: Object.values(input.savedGrandparents).filter(Boolean).length,
      isRequired: true,
    },
  ];
}

function optionalParentSpouseNavItems(input: FamilySectionNavInput): FamilySectionNavItem[] {
  return [
    {
      key: 'father-wives',
      label: 'زوجات الأب',
      description: input.hasFatherWives ? 'أكمل كل بطاقة مضافة' : 'يظهر عند الحاجة',
      status: input.hasFatherWives ? (input.fatherWivesOk ? 'complete' : 'missing') : 'optional',
      count: input.fatherWivesCount,
      isRequired: input.hasFatherWives,
    },
    {
      key: 'mother-husbands',
      label: 'أزواج الأم',
      description: input.hasMotherHusbands ? 'أكمل كل بطاقة مضافة' : 'يظهر عند الحاجة',
      status: input.hasMotherHusbands ? (input.motherHusbandsOk ? 'complete' : 'missing') : 'optional',
      count: input.motherHusbandsCount,
      isRequired: input.hasMotherHusbands,
    },
  ];
}

function relativeFamilySectionNavItems(input: FamilySectionNavInput): FamilySectionNavItem[] {
  return (Object.keys(RELATIVE_LABEL) as RelativeKind[]).map((kind) => {
    const members = input.relatives[kind];
    const savedCount = input.savedRelatives[kind].filter(Boolean).length;
    const isComplete = members.length === 0 || input.savedRelatives[kind].every(Boolean);
    return {
      key: kind,
      label: RELATIVE_LABEL[kind].plural,
      description: members.length > 0 ? `${savedCount} من ${members.length} محفوظ` : 'أدخل العدد إن وجد',
      status: members.length > 0 ? (isComplete ? 'complete' : 'missing') : 'optional',
      count: members.length,
      isRequired: members.length > 0,
    };
  });
}

function FamilySectionNavigator({
  items,
  activeKey,
  onSelect,
}: {
  items: readonly FamilySectionNavItem[];
  activeKey: TabKey;
  onSelect: (key: TabKey) => void;
}): JSX.Element {
  return (
    <Card variant="compact" className="p-3">
      <FamilySectionNavigatorHeader />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <FamilySectionNavigatorButton
            key={item.key}
            item={item}
            isActive={activeKey === item.key}
            onSelect={onSelect}
          />
        ))}
      </div>
    </Card>
  );
}

function FamilySectionNavigatorHeader(): JSX.Element {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-sm font-bold text-ink-900">مسار إدخال بيانات العائلة</h3>
        <p className="mt-0.5 text-2xs text-ink-500">
          انتقل بين الأقسام، واحفظ كل بطاقة حتى تتحول حالتها إلى «محفوظ».
        </p>
      </div>
      <FamilySectionLegend />
    </div>
  );
}

function FamilySectionLegend(): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2 text-2xs">
      <LegendPill tone="complete" label="محفوظ" icon={<CheckCircle2 size={11} strokeWidth={1.75} aria-hidden />} />
      <LegendPill tone="missing" label="ناقص" icon={<AlertCircle size={11} strokeWidth={1.75} aria-hidden />} />
      <LegendPill tone="optional" label="اختياري" icon={<CircleDashed size={11} strokeWidth={1.75} aria-hidden />} />
    </div>
  );
}

function FamilySectionNavigatorButton({
  item,
  isActive,
  onSelect,
}: {
  item: FamilySectionNavItem;
  isActive: boolean;
  onSelect: (key: TabKey) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.key)}
      className={cn(
        'min-h-10 rounded-md border px-3 py-2 text-start transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:shadow-focus-teal',
        isActive
          ? 'border-teal-500 bg-teal-50 text-ink-900'
          : 'border-border-subtle bg-surface-card text-ink-800 hover:border-border-strong hover:bg-ink-50',
      )}
      aria-current={isActive ? 'step' : undefined}
    >
      <FamilySectionNavigatorButtonBody item={item} />
    </button>
  );
}

function FamilySectionNavigatorButtonBody({ item }: { item: FamilySectionNavItem }): JSX.Element {
  return (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-sm font-bold">{item.label}</span>
          <span className="mt-0.5 block text-2xs leading-normal text-ink-500">
            {item.description}
          </span>
        </span>
        <FamilySectionStatusIcon status={item.status} />
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        <RequiredPill isRequired={item.isRequired} />
        {typeof item.count === 'number' && item.count > 0 && (
          <span className="rounded-pill bg-surface-card px-2 py-0.5 text-2xs text-ink-600">
            العدد {item.count}
          </span>
        )}
      </span>
    </>
  );
}

function RequiredPill({ isRequired }: { isRequired: boolean }): JSX.Element {
  return (
    <span
      className={cn(
        'rounded-pill px-2 py-0.5 text-2xs',
        isRequired ? 'bg-gold-50 text-gold-700' : 'bg-ink-100 text-ink-600',
      )}
    >
      {isRequired ? 'مطلوب' : 'اختياري'}
    </span>
  );
}

function LegendPill({
  tone,
  label,
  icon,
}: {
  tone: FamilySectionStatus;
  label: string;
  icon: React.ReactNode;
}): JSX.Element {
  const toneClass = {
    complete: 'bg-teal-50 text-teal-700',
    missing: 'bg-danger-bg text-terra-700',
    optional: 'bg-ink-100 text-ink-600',
  } satisfies Record<FamilySectionStatus, string>;

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-pill px-2 py-1', toneClass[tone])}>
      {icon}
      {label}
    </span>
  );
}

function FamilySectionStatusIcon({ status }: { status: FamilySectionStatus }): JSX.Element {
  if (status === 'complete') {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
        <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden />
      </span>
    );
  }
  if (status === 'missing') {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger-bg text-terra-700">
        <AlertCircle size={14} strokeWidth={1.75} aria-hidden />
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
      <CircleDashed size={14} strokeWidth={1.75} aria-hidden />
    </span>
  );
}

function SaveStatusBadge({ isSaved }: { isSaved: boolean }): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs font-medium',
        isSaved ? 'bg-teal-50 text-teal-700' : 'bg-danger-bg text-terra-700',
      )}
    >
      {isSaved ? (
        <CheckCircle2 size={11} strokeWidth={1.75} aria-hidden />
      ) : (
        <AlertCircle size={11} strokeWidth={1.75} aria-hidden />
      )}
      {isSaved ? 'محفوظ' : 'غير محفوظ'}
    </span>
  );
}
