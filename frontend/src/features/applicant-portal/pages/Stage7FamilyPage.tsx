/**
 * Stage 7 — family data (PDF pp.8-10, MOI-aligned).
 *
 * The MOI reference flow collects only the three primary household members:
 *   - الوالد   (always required)
 *   - الوالدة (always required)
 *   - زوج الوالدة (optional — only when the applicant ticks
 *     "الوالدة متزوجة بغير الوالد")
 *
 * The previous extensive family-tree (grandparents, siblings, relatives to
 * the 4th degree) is intentionally dropped to match the PDF — see
 * `docs/migration/applicant-flow-moi-alignment/REPORT.md` for the
 * security-clearance impact note. Investigations now collects extended
 * family data through its own dedicated surface rather than at applicant
 * registration time.
 *
 * Tab strip (matches the "بيانات الوالدين" dropdown in the PDF):
 *   1. بيانات الوالد
 *   2. بيانات الوالدة
 *   3. بيانات زوج الوالدة (conditional)
 *   4. عرض  (summary table + اعتماد button — disabled until tabs 1 + 2 saved)
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { Check, Heart, Info, Pencil, ShieldCheck, Users } from 'lucide-react';
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

interface ParentForm {
  name: string;
  shuhra?: string; // father only
  religion: 'مسلم' | 'مسيحي';
  dateOfBirth: string;
  birthGovernorate: string;
  birthDistrict: string;
  deceased: boolean;
  residenceGovernorate: string;
  residenceDistrict: string;
  residenceDetail: string;
}

const EMPTY_PARENT: ParentForm = {
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
};

type TabKey = 'father' | 'mother' | 'stepfather' | 'view';

export function Stage7FamilyPage(): JSX.Element {
  const navigate = useNavigate();
  const setParentsApproved = useApplicantPortalStore((s) => s.setParentsApproved);
  const approveMut = useApproveParentsMutation(APPLICANT_ID);

  const [tab, setTab] = useState<TabKey>('father');
  const [father, setFather] = useState<ParentForm>(EMPTY_PARENT);
  const [mother, setMother] = useState<ParentForm>(EMPTY_PARENT);
  const [stepfather, setStepfather] = useState<ParentForm>(EMPTY_PARENT);
  const [motherRemarried, setMotherRemarried] = useState(false);
  const [savedFather, setSavedFather] = useState(false);
  const [savedMother, setSavedMother] = useState(false);
  const [savedStepfather, setSavedStepfather] = useState(false);

  const canApprove = savedFather && savedMother && (!motherRemarried || savedStepfather);

  const onApprove = async (): Promise<void> => {
    if (!canApprove) return;
    await approveMut.mutateAsync();
    setParentsApproved(true);
    toast('تم اعتماد بيانات الوالدين', 'success');
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
            <h2 className="font-ar-display text-xl font-bold text-ink-900">بيانات الوالدين</h2>
            <p className="mt-1 text-sm text-ink-500 leading-normal">
              أدخل بيانات الوالد والوالدة. هذه البيانات تخضع لتحرّ مفصّل قبل اعتماد الطلب. لا يمكنك
              تحديد موعد الإختبار قبل الضغط على «اعتماد» في تبويب «عرض».
            </p>
          </div>
        </header>
        <label className="mt-4 flex items-start gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
          <input
            type="checkbox"
            checked={motherRemarried}
            onChange={(e) => setMotherRemarried(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-teal-500"
          />
          <span className="leading-normal">
            <Heart size={11} strokeWidth={1.75} className="me-1 inline-block" aria-hidden />
            الوالدة متزوجة بغير الوالد — قم بتفعيل هذا الخيار لإظهار تبويب «بيانات زوج الوالدة».
          </span>
        </label>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <Tabs.List>
          <Tabs.Tab value="father">
            <TabLabel saved={savedFather}>بيانات الوالد</TabLabel>
          </Tabs.Tab>
          <Tabs.Tab value="mother">
            <TabLabel saved={savedMother}>بيانات الوالدة</TabLabel>
          </Tabs.Tab>
          {motherRemarried && (
            <Tabs.Tab value="stepfather">
              <TabLabel saved={savedStepfather}>بيانات زوج الوالدة</TabLabel>
            </Tabs.Tab>
          )}
          <Tabs.Tab value="view">عرض</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="father">
          <ParentFormCard
            form={father}
            title="بيانات الوالد"
            showShuhra
            onChange={setFather}
            onSave={() => {
              setSavedFather(true);
              toast('تم حفظ بيانات الوالد', 'success');
              setTab('mother');
            }}
          />
        </Tabs.Panel>
        <Tabs.Panel value="mother">
          <ParentFormCard
            form={mother}
            title="بيانات الوالدة"
            onChange={setMother}
            onSave={() => {
              setSavedMother(true);
              toast('تم حفظ بيانات الوالدة', 'success');
              setTab(motherRemarried ? 'stepfather' : 'view');
            }}
          />
        </Tabs.Panel>
        {motherRemarried && (
          <Tabs.Panel value="stepfather">
            <ParentFormCard
              form={stepfather}
              title="بيانات زوج الوالدة"
              onChange={setStepfather}
              onSave={() => {
                setSavedStepfather(true);
                toast('تم حفظ بيانات زوج الوالدة', 'success');
                setTab('view');
              }}
            />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="view">
          <ViewPanel
            rows={buildRows(father, mother, motherRemarried ? stepfather : null, {
              savedFather,
              savedMother,
              savedStepfather,
            })}
            canApprove={canApprove}
            approving={approveMut.isPending}
            onApprove={onApprove}
            onEdit={(role) => setTab(role)}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

/* ─── ParentFormCard ──────────────────────────────────────────────── */

function ParentFormCard({
  form,
  title,
  onChange,
  onSave,
  showShuhra,
}: {
  form: ParentForm;
  title: string;
  onChange: (next: ParentForm) => void;
  onSave: () => void;
  showShuhra?: boolean;
}): JSX.Element {
  const { register, handleSubmit, control, formState: { errors } } = useForm<ParentForm>({
    defaultValues: form,
  });
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
          containerClassName={showShuhra ? undefined : 'md:col-span-2'}
        />
        {showShuhra && <Input label="الشهرة" {...register('shuhra')} />}
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
        <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" {...register('deceased')} className="h-4 w-4 cursor-pointer accent-teal-500" />
          متوفي
        </label>
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
        <div className="md:col-span-2 flex justify-end pt-1">
          <Button type="submit" variant="primary">
            حفظ
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ─── ViewPanel + table ───────────────────────────────────────────── */

interface ViewRow {
  serial: number;
  name: string;
  relation: string;
  saved: boolean;
  roleKey: TabKey;
}

function buildRows(
  father: ParentForm,
  mother: ParentForm,
  stepfather: ParentForm | null,
  saved: { savedFather: boolean; savedMother: boolean; savedStepfather: boolean },
): readonly ViewRow[] {
  const rows: ViewRow[] = [
    { serial: 1, name: father.name || '—', relation: 'الوالد', saved: saved.savedFather, roleKey: 'father' },
    { serial: 2, name: mother.name || '—', relation: 'الوالدة', saved: saved.savedMother, roleKey: 'mother' },
  ];
  if (stepfather) {
    rows.push({
      serial: 3,
      name: stepfather.name || '—',
      relation: 'زوج الوالدة',
      saved: saved.savedStepfather,
      roleKey: 'stepfather',
    });
  }
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
        <h3 className="font-ar-display text-md font-bold text-ink-900">عرض بيانات الوالدين</h3>
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
        rowKey={(r: ViewRow) => `parent-${r.roleKey}`}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xs text-ink-500">
          بعد اعتماد البيانات لا يمكن تعديل تبويبات الوالدين إلا بإجراء إداري.
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

function TabLabel({ saved, children }: { saved: boolean; children: React.ReactNode }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      {saved && (
        <Check size={11} strokeWidth={2} className="text-teal-600" aria-hidden />
      )}
      <span>{children}</span>
    </span>
  );
}
