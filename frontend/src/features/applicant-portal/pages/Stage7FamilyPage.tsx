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

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { Check, Heart, Info, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  IconStamp,
  Input,
  SearchSelect,
  Select,
  Tabs,
  Textarea,
  toast,
} from '@/shared/components';
import type { DataTableColumn, SearchSelectOption } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { useApproveParentsMutation } from '../api/applicantPortal.queries';
import { REF_GOVERNORATES } from '@/shared/mock-data/referenceData';
import { CITIES } from '@/shared/mock-data/dictionaries';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;

const GOV_OPTIONS: readonly SearchSelectOption[] = REF_GOVERNORATES.map((g) => ({
  value: g.nameAr,
  label: g.nameAr,
  keywords: g.nameEn,
}));

const DISTRICT_OPTIONS: readonly SearchSelectOption[] = CITIES.map((c) => ({
  value: c,
  label: c,
}));

const PROFESSION_OPTIONS = [
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

const MEMBERSHIP_PROFESSIONS = new Set(['police_officer', 'army_officer']);

interface FamilyMemberForm {
  name: string;
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
  membershipNumber?: string;
}

const EMPTY_MEMBER: FamilyMemberForm = {
  name: '',
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
  membershipNumber: '',
};

type TabKey = 'father' | 'father-wives' | 'mother' | 'mother-husbands' | 'grandparents' | 'view';

interface GrandparentsForm {
  paternalGrandfather: FamilyMemberForm;
  paternalGrandmother: FamilyMemberForm;
  maternalGrandfather: FamilyMemberForm;
  maternalGrandmother: FamilyMemberForm;
}

export function Stage7FamilyPage(): JSX.Element {
  const navigate = useNavigate();
  const setParentsApproved = useApplicantPortalStore((s) => s.setParentsApproved);
  const approveMut = useApproveParentsMutation(APPLICANT_ID);

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

  const [savedFather, setSavedFather] = useState(false);
  const [savedMother, setSavedMother] = useState(false);
  const [savedGrandparents, setSavedGrandparents] = useState(false);
  const [savedFatherWives, setSavedFatherWives] = useState<boolean[]>([]);
  const [savedMotherHusbands, setSavedMotherHusbands] = useState<boolean[]>([]);

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

  const fatherWivesOk = !hasFatherWives || (
    fatherWives.length > 0 && savedFatherWives.every(Boolean)
  );
  const motherHusbandsOk = !hasMotherHusbands || (
    motherHusbands.length > 0 && savedMotherHusbands.every(Boolean)
  );
  const canApprove =
    savedFather && savedMother && savedGrandparents && fatherWivesOk && motherHusbandsOk;

  const onApprove = async (): Promise<void> => {
    if (!canApprove) return;
    await approveMut.mutateAsync();
    setParentsApproved(true);
    toast('تم اعتماد بيانات العائلة', 'success');
    navigate(ROUTES.applicantExamSchedule);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <header className="flex items-start gap-3">
          <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Users size={20} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <h2 className="font-ar-display text-xl font-bold text-ink-900">بيانات العائلة</h2>
            <p className="mt-1 text-sm text-ink-500 leading-normal">
              أدخل بيانات الوالدين والأجداد، ويمكنك إضافة بيانات زوجات الأب وأزواج الأم
              عند الحاجة. هذه البيانات تخضع لتحرّ مفصّل قبل اعتماد الطلب — لا يمكنك
              تحديد موعد الإختبار قبل الضغط على «اعتماد» في تبويب «عرض».
            </p>
          </div>
        </header>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="flex items-start gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
            <input
              type="checkbox"
              checked={hasFatherWives}
              onChange={(e) => toggleHasFatherWives(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-teal-500"
            />
            <span className="leading-normal">
              الأب متزوج بأخرى — قم بتفعيل هذا الخيار لإظهار تبويب «زوجات الأب».
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
            <input
              type="checkbox"
              checked={hasMotherHusbands}
              onChange={(e) => toggleHasMotherHusbands(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-teal-500"
            />
            <span className="leading-normal">
              الأم متزوجة بغير الأب — قم بتفعيل هذا الخيار لإظهار تبويب «أزواج الأم».
            </span>
          </label>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <Tabs.List>
          <Tabs.Tab value="father">
            <TabLabel saved={savedFather}>الأب</TabLabel>
          </Tabs.Tab>
          {hasFatherWives && (
            <Tabs.Tab value="father-wives">
              <TabLabel saved={fatherWivesOk}>
                زوجات الأب {fatherWives.length > 0 ? `(${fatherWives.length})` : ''}
              </TabLabel>
            </Tabs.Tab>
          )}
          <Tabs.Tab value="mother">
            <TabLabel saved={savedMother}>الأم</TabLabel>
          </Tabs.Tab>
          {hasMotherHusbands && (
            <Tabs.Tab value="mother-husbands">
              <TabLabel saved={motherHusbandsOk}>
                أزواج الأم {motherHusbands.length > 0 ? `(${motherHusbands.length})` : ''}
              </TabLabel>
            </Tabs.Tab>
          )}
          <Tabs.Tab value="grandparents">
            <TabLabel saved={savedGrandparents}>الأجداد</TabLabel>
          </Tabs.Tab>
          <Tabs.Tab value="view">عرض</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="father">
          <MemberFormCard
            form={father}
            title="بيانات الأب"
            onChange={setFather}
            onSave={() => {
              setSavedFather(true);
              toast('تم حفظ بيانات الأب', 'success');
              setTab(hasFatherWives ? 'father-wives' : 'mother');
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="father-wives">
          <MultiMemberPanel
            title="زوجات الأب"
            singular="زوجة الأب"
            members={fatherWives}
            savedFlags={savedFatherWives}
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
            onSave={(i) => {
              setSavedFatherWives((xs) => xs.map((s, idx) => (idx === i ? true : s)));
              toast(`تم حفظ بيانات زوجة الأب رقم ${i + 1}`, 'success');
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="mother">
          <MemberFormCard
            form={mother}
            title="بيانات الأم"
            onChange={setMother}
            onSave={() => {
              setSavedMother(true);
              toast('تم حفظ بيانات الأم', 'success');
              setTab(hasMotherHusbands ? 'mother-husbands' : 'grandparents');
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="mother-husbands">
          <MultiMemberPanel
            title="أزواج الأم"
            singular="زوج الأم"
            members={motherHusbands}
            savedFlags={savedMotherHusbands}
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
            onSave={(i) => {
              setSavedMotherHusbands((xs) => xs.map((s, idx) => (idx === i ? true : s)));
              toast(`تم حفظ بيانات زوج الأم رقم ${i + 1}`, 'success');
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="grandparents">
          <GrandparentsPanel
            value={grandparents}
            onChange={setGrandparents}
            onSave={() => {
              setSavedGrandparents(true);
              toast('تم حفظ بيانات الأجداد', 'success');
              setTab('view');
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="view">
          <ViewPanel
            rows={buildRows({
              father,
              mother,
              fatherWives,
              motherHusbands,
              grandparents,
              savedFather,
              savedMother,
              savedFatherWives,
              savedMotherHusbands,
              savedGrandparents,
            })}
            canApprove={canApprove}
            approving={approveMut.isPending}
            onApprove={onApprove}
            onEdit={(t) => setTab(t)}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

/* ─── Reusable single-member form ──────────────────────────────────── */

function MemberFormCard({
  form,
  title,
  onChange,
  onSave,
}: {
  form: FamilyMemberForm;
  title: string;
  onChange: (next: FamilyMemberForm) => void;
  onSave: () => void;
}): JSX.Element {
  /* shouldUnregister: true is critical — when the متوفي toggle hides the
   * residence fields, those validators must drop with the JSX. Without
   * this RHF keeps them registered with `required: 'مطلوب'` and the
   * submit silently fails, so the parent's onChange never fires and
   * "حفظ الجميع" stays dimmed for an all-deceased Grandparents tab. */
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FamilyMemberForm>({
    defaultValues: form,
    shouldUnregister: true,
  });
  const profession = watch('profession');
  const deceased = watch('deceased');
  const showMembership = MEMBERSHIP_PROFESSIONS.has(profession);

  const submit = handleSubmit((values) => {
    onChange(values);
    onSave();
  });

  return (
    <Card>
      <header className="mb-3 flex items-center gap-2">
        <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Users size={14} strokeWidth={1.75} />
        </span>
        <h3 className="font-ar-display text-md font-bold text-ink-900">{title}</h3>
      </header>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <Input
          label="الاسم"
          required
          {...register('name', { required: 'مطلوب', minLength: { value: 2, message: 'مطلوب' } })}
          error={errors.name?.message}
          containerClassName="md:col-span-2"
        />
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
          {...register('dateOfBirth', { required: 'مطلوب' })}
          error={errors.dateOfBirth?.message}
        />
        <Field label="محافظة الميلاد" required error={errors.birthGovernorate?.message}>
          <Controller
            control={control}
            name="birthGovernorate"
            rules={{ required: 'مطلوب' }}
            render={({ field }) => (
              <SearchSelect
                ariaLabel="محافظة الميلاد"
                placeholder="اختر المحافظة"
                options={GOV_OPTIONS}
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
                placeholder="اختر القسم"
                options={DISTRICT_OPTIONS}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? '')}
              />
            )}
          />
        </Field>
        <Select
          label="المهنة"
          required
          {...register('profession', { required: 'مطلوب' })}
          options={[...PROFESSION_OPTIONS]}
          error={errors.profession?.message}
        />
        {showMembership && (
          <Input
            label="رقم العضوية"
            required
            dir="ltr"
            {...register('membershipNumber', { required: 'مطلوب' })}
            error={errors.membershipNumber?.message}
          />
        )}
        <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" {...register('deceased')} className="h-4 w-4 cursor-pointer accent-teal-500" />
          متوفي
        </label>
        {!deceased && (
          <>
            <Field label="محافظة الإقامة" required error={errors.residenceGovernorate?.message}>
              <Controller
                control={control}
                name="residenceGovernorate"
                rules={{ required: 'مطلوب' }}
                render={({ field }) => (
                  <SearchSelect
                    ariaLabel="محافظة الإقامة"
                    placeholder="اختر المحافظة"
                    options={GOV_OPTIONS}
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
                    placeholder="اختر القسم"
                    options={DISTRICT_OPTIONS}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? '')}
                  />
                )}
              />
            </Field>
            <Textarea
              label="تفصيلي عنوان الإقامة"
              rows={2}
              required
              {...register('residenceDetail', { required: 'مطلوب', minLength: { value: 5, message: 'مطلوب' } })}
              error={errors.residenceDetail?.message}
              containerClassName="md:col-span-2"
            />
          </>
        )}
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
  onAdd,
  onChange,
  onRemove,
  onSave,
}: {
  title: string;
  singular: string;
  members: readonly FamilyMemberForm[];
  savedFlags: readonly boolean[];
  onAdd: () => void;
  onChange: (i: number, next: FamilyMemberForm) => void;
  onRemove: (i: number) => void;
  onSave: (i: number) => void;
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
            title={`${singular} رقم ${i + 1}${savedFlags[i] ? ' — محفوظ' : ''}`}
            onChange={(next) => onChange(i, next)}
            onSave={() => onSave(i)}
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Grandparents panel — 4 fixed members ─────────────────────────── */

function GrandparentsPanel({
  value,
  onChange,
  onSave,
}: {
  value: GrandparentsForm;
  onChange: (next: GrandparentsForm) => void;
  onSave: () => void;
}): JSX.Element {
  /* Track local saved flags per grandparent so the "حفظ الجميع" button
   * only fires when all four sub-forms are valid + saved. Simpler UX:
   * render them all inline, save them all with one button at the end. */
  const [stale, setStale] = useState<GrandparentsForm>(value);
  const allFilled =
    isFilled(stale.paternalGrandfather) &&
    isFilled(stale.paternalGrandmother) &&
    isFilled(stale.maternalGrandfather) &&
    isFilled(stale.maternalGrandmother);

  const updateOne = <K extends keyof GrandparentsForm>(
    key: K,
    next: FamilyMemberForm,
  ): void => {
    setStale((s) => ({ ...s, [key]: next }));
  };

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
        form={stale.paternalGrandfather}
        title="الجد لأب"
        onChange={(next) => updateOne('paternalGrandfather', next)}
        onSave={() => undefined}
      />
      <MemberFormCard
        form={stale.paternalGrandmother}
        title="الجدة لأب"
        onChange={(next) => updateOne('paternalGrandmother', next)}
        onSave={() => undefined}
      />
      <MemberFormCard
        form={stale.maternalGrandfather}
        title="الجد لأم"
        onChange={(next) => updateOne('maternalGrandfather', next)}
        onSave={() => undefined}
      />
      <MemberFormCard
        form={stale.maternalGrandmother}
        title="الجدة لأم"
        onChange={(next) => updateOne('maternalGrandmother', next)}
        onSave={() => undefined}
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xs text-ink-500">
            اضغط «حفظ الجميع» بعد ملء الحقول الأربعة (كل بطاقة يجب الضغط على «حفظ» فيها أولاً).
          </p>
          <Button
            variant="primary"
            disabled={!allFilled}
            onClick={() => {
              onChange(stale);
              onSave();
            }}
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
  const baseOk =
    m.name.length >= 2 &&
    m.dateOfBirth.length > 0 &&
    m.birthGovernorate.length > 0 &&
    m.birthDistrict.length > 0 &&
    m.profession.length > 0 &&
    (!MEMBERSHIP_PROFESSIONS.has(m.profession) || (m.membershipNumber ?? '').length > 0);
  if (!baseOk) return false;
  /* Deceased members skip the residence requirement — those fields are
   * removed from the form when the متوفي toggle is on. */
  if (m.deceased) return true;
  return (
    m.residenceGovernorate.length > 0 &&
    m.residenceDistrict.length > 0 &&
    m.residenceDetail.length >= 5
  );
}

/* ─── ViewPanel + table ───────────────────────────────────────────── */

interface ViewRow {
  serial: number;
  name: string;
  relation: string;
  profession: string;
  saved: boolean;
  roleKey: TabKey;
}

function professionLabel(code: string): string {
  return PROFESSION_OPTIONS.find((o) => o.value === code)?.label ?? '—';
}

function buildRows(input: {
  father: FamilyMemberForm;
  mother: FamilyMemberForm;
  fatherWives: readonly FamilyMemberForm[];
  motherHusbands: readonly FamilyMemberForm[];
  grandparents: GrandparentsForm;
  savedFather: boolean;
  savedMother: boolean;
  savedFatherWives: readonly boolean[];
  savedMotherHusbands: readonly boolean[];
  savedGrandparents: boolean;
}): readonly ViewRow[] {
  const rows: ViewRow[] = [];
  let n = 1;
  rows.push({
    serial: n++,
    name: input.father.name || '—',
    relation: 'الأب',
    profession: professionLabel(input.father.profession),
    saved: input.savedFather,
    roleKey: 'father',
  });
  input.fatherWives.forEach((w, i) => {
    rows.push({
      serial: n++,
      name: w.name || '—',
      relation: `زوجة الأب ${i + 1}`,
      profession: professionLabel(w.profession),
      saved: input.savedFatherWives[i] === true,
      roleKey: 'father-wives',
    });
  });
  rows.push({
    serial: n++,
    name: input.mother.name || '—',
    relation: 'الأم',
    profession: professionLabel(input.mother.profession),
    saved: input.savedMother,
    roleKey: 'mother',
  });
  input.motherHusbands.forEach((h, i) => {
    rows.push({
      serial: n++,
      name: h.name || '—',
      relation: `زوج الأم ${i + 1}`,
      profession: professionLabel(h.profession),
      saved: input.savedMotherHusbands[i] === true,
      roleKey: 'mother-husbands',
    });
  });
  rows.push({
    serial: n++,
    name: input.grandparents.paternalGrandfather.name || '—',
    relation: 'الجد لأب',
    profession: professionLabel(input.grandparents.paternalGrandfather.profession),
    saved: input.savedGrandparents,
    roleKey: 'grandparents',
  });
  rows.push({
    serial: n++,
    name: input.grandparents.paternalGrandmother.name || '—',
    relation: 'الجدة لأب',
    profession: professionLabel(input.grandparents.paternalGrandmother.profession),
    saved: input.savedGrandparents,
    roleKey: 'grandparents',
  });
  rows.push({
    serial: n++,
    name: input.grandparents.maternalGrandfather.name || '—',
    relation: 'الجد لأم',
    profession: professionLabel(input.grandparents.maternalGrandfather.profession),
    saved: input.savedGrandparents,
    roleKey: 'grandparents',
  });
  rows.push({
    serial: n++,
    name: input.grandparents.maternalGrandmother.name || '—',
    relation: 'الجدة لأم',
    profession: professionLabel(input.grandparents.maternalGrandmother.profession),
    saved: input.savedGrandparents,
    roleKey: 'grandparents',
  });
  return rows;
}

function ViewPanel({
  rows,
  canApprove,
  approving,
  onApprove,
  onEdit,
}: {
  rows: readonly ViewRow[];
  canApprove: boolean;
  approving: boolean;
  onApprove: () => void;
  onEdit: (role: TabKey) => void;
}): JSX.Element {
  const columns: DataTableColumn<ViewRow>[] = useMemo(
    () => [
      { key: 'serial', label: 'م', width: '56px', render: (r: ViewRow) => <span className="font-numeric tnum">{r.serial}</span> },
      { key: 'name', label: 'الإسم', render: (r: ViewRow) => r.name },
      { key: 'relation', label: 'درجة القرابة', render: (r: ViewRow) => r.relation },
      { key: 'profession', label: 'المهنة', render: (r: ViewRow) => r.profession },
      {
        key: 'saved',
        label: 'الحالة',
        render: (r: ViewRow) =>
          r.saved ? (
            <Badge tone="success">
              <Check size={11} strokeWidth={1.75} className="me-1 inline-block" />
              محفوظ
            </Badge>
          ) : (
            <Badge tone="warning">لم يُحفَظ</Badge>
          ),
      },
      {
        key: 'actions',
        label: 'إجراءات',
        render: (r: ViewRow) => (
          <button
            type="button"
            onClick={() => onEdit(r.roleKey)}
            aria-label={`تعديل ${r.relation}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-default bg-surface-card text-ink-700 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700"
          >
            <Pencil size={13} strokeWidth={1.75} />
          </button>
        ),
      },
    ],
    [onEdit],
  );

  return (
    <Card>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-ar-display text-md font-bold text-ink-900">عرض بيانات العائلة</h3>
        <Badge tone={canApprove ? 'success' : 'neutral'}>
          {canApprove ? (
            <>
              <ShieldCheck size={11} strokeWidth={1.75} className="me-1 inline-block" />
              جاهز للاعتماد
            </>
          ) : (
            <>
              <Info size={11} strokeWidth={1.75} className="me-1 inline-block" />
              أكمل البيانات المطلوبة
            </>
          )}
        </Badge>
      </header>
      <DataTable<ViewRow>
        data={[...rows]}
        columns={columns}
        rowKey={(r: ViewRow) => `${r.roleKey}-${r.serial}`}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xs text-ink-500">
          بعد اعتماد البيانات لا يمكن تعديل التبويبات إلا بإجراء إداري.
        </p>
        <Button
          variant="primary"
          size="lg"
          disabled={!canApprove}
          isLoading={approving}
          onClick={onApprove}
          leadingIcon={<IconStamp width={14} height={14} />}
        >
          اعتماد
        </Button>
      </div>
    </Card>
  );
}

/* ─── small helpers ──────────────────────────────────────────────── */

function TabLabel({ children, saved }: { children: React.ReactNode; saved: boolean }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      {saved && (
        <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-teal-100 text-teal-700">
          <Check size={10} strokeWidth={2} />
        </span>
      )}
    </span>
  );
}

// avoid "Heart unused" — used in old version, removed cleanly here
void Heart;
