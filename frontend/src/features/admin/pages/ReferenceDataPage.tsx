/**
 * ReferenceDataPage — 8 tabs of CRUD over the platform's reference codes.
 * Source: Tasks/KARASA_GAPS.md §1.2.B.
 *
 * Each tab uses the shared <DataTable> for the listing, <Drawer> for the
 * add/edit form, and <Modal> for delete confirmation. Forms are typed
 * per-tab via the `ReferenceRowMap` discriminated union.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { cn } from '@/shared/lib/cn';
import {
  REFERENCE_TAB_LABELS,
} from '@/shared/mock-data/referenceData';
import {
  LOOKUP_HAS_GENDER,
  LOOKUP_LABELS,
  LOOKUP_PARENT,
} from '@/shared/mock-data/lookups';
import {
  useReferenceCreate,
  useReferenceData,
  useReferenceRemove,
  useReferenceUpdate,
} from '../api/referenceData.queries';
import { LookupTab } from '../components/lookups/LookupTab';
import { ImportLookupButton } from '../components/lookups/ImportLookupButton';
import type { ExistingRow, ImportLookupKey } from '../api/lookup-import';
import { LOOKUP_IMPORT_LABELS } from '../components/lookups/import-lookup-labels';
import type {
  LookupKey,
  RefCaseType,
  RefCollege,
  RefGovernorate,
  RefNationality,
  RefQualification,
  RefRank,
  RefRelationship,
  RefSpecialization,
  ReferenceTab,
} from '@/shared/types/domain';

/* The unified tab key — either a Sprint-1 ReferenceTab (typed Ref* shapes)
 * or a Gap-I LookupKey (unified LookupRow). Section labels keep the two
 * groups visually separate in the tab strip. */
type TabKey = ReferenceTab | LookupKey;

/* Map Sprint-1 ReferenceTab (possibly kebab-case) to ImportLookupKey (camelCase). */
const REF_TAB_TO_IMPORT_KEY: Record<ReferenceTab, ImportLookupKey> = {
  governorates: 'governorates',
  specializations: 'specializations',
  ranks: 'ranks',
  colleges: 'colleges',
  qualifications: 'qualifications',
  nationalities: 'nationalities',
  relationships: 'relationships',
  'case-types': 'caseTypes',
};

const REFERENCE_TABS = Object.keys(REFERENCE_TAB_LABELS) as ReferenceTab[];
const LOOKUP_TABS = Object.keys(LOOKUP_LABELS) as LookupKey[];
const TABS: TabKey[] = [...REFERENCE_TABS, ...LOOKUP_TABS];

function isLookupKey(t: TabKey): t is LookupKey {
  return (LOOKUP_TABS as string[]).includes(t);
}

export function ReferenceDataPage(): JSX.Element {
  const params = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const tab = (TABS.find((t) => t === params.tab) ?? 'governorates');

  const labelOf = (t: TabKey): string =>
    isLookupKey(t) ? LOOKUP_LABELS[t] : REFERENCE_TAB_LABELS[t as ReferenceTab];

  return (
    <CenteredShell>
      <PageHeader
        title="البيانات المرجعية"
        subtitle="إدارة الأكواد المرجعية والقوائم المنسدلة المستخدمة عبر المنظومة"
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'البيانات المرجعية' },
        ]}
      />

      <nav
        role="tablist"
        aria-label="تصنيفات البيانات المرجعية"
        className="mb-5 flex flex-wrap gap-1 border-b border-border-subtle"
      >
        {/* Sprint-1 typed reference tabs */}
        {REFERENCE_TABS.map((t) => {
          const active = t === tab;
          return (
            <Link
              key={t}
              role="tab"
              aria-selected={active}
              to={ROUTES.admin.referenceData(t)}
              className={cn(
                '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors duration-fast ease-standard',
                'focus-visible:shadow-focus-teal focus-visible:outline-none rounded-t-md',
                active
                  ? 'border-accent-500 text-accent-600 font-medium'
                  : 'border-transparent text-ink-500 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              {REFERENCE_TAB_LABELS[t]}
            </Link>
          );
        })}
        <span className="mx-2 hidden self-center text-ink-300 md:inline-block">|</span>
        {/* Gap-I unified lookup tabs */}
        {LOOKUP_TABS.map((t) => {
          const active = t === tab;
          return (
            <Link
              key={t}
              role="tab"
              aria-selected={active}
              to={ROUTES.admin.referenceData(t)}
              className={cn(
                '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors duration-fast ease-standard',
                'focus-visible:shadow-focus-teal focus-visible:outline-none rounded-t-md',
                active
                  ? 'border-accent-500 text-accent-600 font-medium'
                  : 'border-transparent text-ink-500 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              {LOOKUP_LABELS[t]}
            </Link>
          );
        })}
      </nav>

      {isLookupKey(tab) ? (
        <LookupTab
          key={tab}
          lookupKey={tab}
          title={labelOf(tab)}
          parentLookup={LOOKUP_PARENT[tab] ?? undefined}
          hasGender={LOOKUP_HAS_GENDER.has(tab)}
        />
      ) : (
        <ReferenceTabPanel key={tab} tab={tab} onChangeTab={(t) => navigate(ROUTES.admin.referenceData(t))} />
      )}
    </CenteredShell>
  );
}

interface RowBase {
  id: string;
  nameAr?: string;
}

function ReferenceTabPanel({ tab }: { tab: ReferenceTab; onChangeTab?: (t: ReferenceTab) => void }): JSX.Element {
  const { data, isLoading } = useReferenceData(tab);
  const createMut = useReferenceCreate(tab);
  const updateMut = useReferenceUpdate(tab);
  const removeMut = useReferenceRemove(tab);

  /* Build ExistingRow[] for the import collision pass. */
  const existingRows = useMemo<ExistingRow[]>(
    () =>
      (data ?? []).map((r) => {
        const row = r as { id: string; nameAr?: string; deletedAt?: string };
        return {
          collisionKey: row.nameAr ?? row.id,
          id: row.id,
          isArchived: Boolean(row.deletedAt),
          snapshot: r as unknown as Record<string, unknown>,
        };
      }),
    [data],
  );

  const existingSortMax = 0; // Sprint-1 typed rows don't expose sortOrder

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RowBase | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RowBase | null>(null);

  const columns = useMemo(() => buildColumns(tab), [tab]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-500">
          إجمالي السجلات:{' '}
          <span className="font-numeric tnum">{(data?.length ?? 0).toLocaleString('en-US')}</span>
        </p>
        <div className="flex items-center gap-2">
          <ImportLookupButton
            lookupKey={REF_TAB_TO_IMPORT_KEY[tab]}
            lookupTitle={LOOKUP_IMPORT_LABELS[REF_TAB_TO_IMPORT_KEY[tab]]}
            existingRows={existingRows}
            existingSortMax={existingSortMax}
          />
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            إضافة جديد
          </Button>
        </div>
      </div>

      <DataTable
        data={(data ?? []) as RowBase[]}
        columns={[
          ...(columns as DataTableColumn<RowBase>[]),
          {
            key: '_actions',
            label: <span className="sr-only">إجراءات</span>,
            align: 'end',
            render: (row) => (
              <div className="inline-flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="تعديل"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(row);
                    setDrawerOpen(true);
                  }}
                >
                  <Pencil size={14} strokeWidth={1.75} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="حذف"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(row);
                  }}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </Button>
              </div>
            ),
          },
        ]}
        rowKey={(row) => row.id}
        loading={isLoading}
        empty={<EmptyState variant="generic" title="لا توجد بيانات" description="أضِف أول سجل لبدء العمل." />}
        zebraStripes
        stickyHeader
      />

      <ReferenceFormDrawer
        tab={tab}
        open={drawerOpen}
        editing={editing}
        onClose={() => setDrawerOpen(false)}
        onSubmit={(payload) => {
          if (editing) {
            updateMut.mutate(
              { id: editing.id, patch: payload as Partial<RowBase> },
              {
                onSuccess: () => {
                  toast('تم حفظ التعديلات', 'success');
                  setDrawerOpen(false);
                },
              },
            );
          } else {
            /* Cast through unknown — payload shape matches one of the discriminated
               row types based on the active tab; the union complains generically. */
            createMut.mutate(payload as unknown as never, {
              onSuccess: () => {
                toast('تم إضافة السجل', 'success');
                setDrawerOpen(false);
              },
            });
          }
        }}
      />

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="تأكيد الحذف"
        size="sm"
      >
        <Modal.Body>
          <p className="text-sm text-ink-700">
            هل أنت متأكد من حذف السجل{' '}
            <span className="font-medium text-ink-900">{confirmDelete?.nameAr ?? confirmDelete?.id}</span>؟ هذا الإجراء غير قابل للتراجع.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!confirmDelete) return;
              removeMut.mutate(confirmDelete.id, {
                onSuccess: () => {
                  toast('تم الحذف', 'success');
                  setConfirmDelete(null);
                },
              });
            }}
          >
            حذف
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

/* ───────────────── columns per tab ───────────────── */

function buildColumns(tab: ReferenceTab): DataTableColumn<unknown>[] {
  if (tab === 'governorates') {
    return ([
      { key: 'id', label: 'الكود', width: 96 },
      { key: 'nameAr', label: 'الاسم بالعربية', render: (r) => r.nameAr },
      { key: 'nameEn', label: 'بالإنجليزية', render: (r) => <span dir="ltr">{r.nameEn}</span> },
      { key: 'region', label: 'الإقليم', render: (r) => REGION_LABELS[r.region] },
      { key: 'active', label: 'نشط', render: (r) => <ActiveBadge active={r.active} /> },
    ] satisfies DataTableColumn<RefGovernorate>[]) as unknown as DataTableColumn<unknown>[];
  }
  if (tab === 'specializations') {
    return ([
      { key: 'id', label: 'الكود', width: 96 },
      { key: 'nameAr', label: 'الاسم', render: (r) => r.nameAr },
      { key: 'code', label: 'كود التخصص', render: (r) => <span dir="ltr">{r.code}</span> },
      { key: 'facultyType', label: 'نوع الكلية', render: (r) => FACULTY_LABELS[r.facultyType] },
      { key: 'active', label: 'نشط', render: (r) => <ActiveBadge active={r.active} /> },
    ] satisfies DataTableColumn<RefSpecialization>[]) as unknown as DataTableColumn<unknown>[];
  }
  if (tab === 'ranks') {
    return ([
      { key: 'id', label: 'الكود', width: 96 },
      { key: 'nameAr', label: 'الرتبة', render: (r) => r.nameAr },
      { key: 'level', label: 'المستوى', numeric: true, render: (r) => r.level },
      { key: 'applicableTo', label: 'الفئة', render: (r) => APPLICABLE_LABELS[r.applicableTo] },
    ] satisfies DataTableColumn<RefRank>[]) as unknown as DataTableColumn<unknown>[];
  }
  if (tab === 'colleges') {
    return ([
      { key: 'id', label: 'الكود', width: 96 },
      { key: 'nameAr', label: 'الكلية / الجامعة', render: (r) => r.nameAr },
      { key: 'governorateId', label: 'المحافظة', render: (r) => r.governorateId },
      { key: 'type', label: 'النوع', render: (r) => COLLEGE_TYPE_LABELS[r.type] },
      { key: 'active', label: 'نشط', render: (r) => <ActiveBadge active={r.active} /> },
    ] satisfies DataTableColumn<RefCollege>[]) as unknown as DataTableColumn<unknown>[];
  }
  if (tab === 'qualifications') {
    return ([
      { key: 'id', label: 'الكود', width: 96 },
      { key: 'nameAr', label: 'المؤهل', render: (r) => r.nameAr },
      { key: 'level', label: 'المستوى', render: (r) => QUAL_LEVEL_LABELS[r.level] },
      { key: 'facultyRequired', label: 'يلزم تخصص', render: (r) => (r.facultyRequired ? 'نعم' : 'لا') },
    ] satisfies DataTableColumn<RefQualification>[]) as unknown as DataTableColumn<unknown>[];
  }
  if (tab === 'nationalities') {
    return ([
      { key: 'id', label: 'الكود', width: 96 },
      { key: 'nameAr', label: 'الجنسية بالعربية', render: (r) => r.nameAr },
      { key: 'nameEn', label: 'بالإنجليزية', render: (r) => <span dir="ltr">{r.nameEn}</span> },
      { key: 'isoCode', label: 'ISO', render: (r) => <span dir="ltr">{r.isoCode}</span> },
    ] satisfies DataTableColumn<RefNationality>[]) as unknown as DataTableColumn<unknown>[];
  }
  if (tab === 'relationships') {
    return ([
      { key: 'id', label: 'الكود', width: 96 },
      { key: 'nameAr', label: 'القرابة', render: (r) => r.nameAr },
      { key: 'degree', label: 'الدرجة', numeric: true, render: (r) => r.degree },
      { key: 'side', label: 'الجهة', render: (r) => RELATION_SIDE_LABELS[r.side] },
    ] satisfies DataTableColumn<RefRelationship>[]) as unknown as DataTableColumn<unknown>[];
  }
  /* case-types */
  return ([
    { key: 'id', label: 'الكود', width: 96 },
    { key: 'nameAr', label: 'نوع القضية', render: (r) => r.nameAr },
    { key: 'severity', label: 'درجة الخطورة', render: (r) => SEVERITY_LABELS[r.severity] },
    {
      key: 'blocksApplication',
      label: 'يحجب الطلب',
      render: (r) =>
        r.blocksApplication ? <Badge tone="danger">يحجب</Badge> : <Badge tone="neutral">لا</Badge>,
    },
  ] satisfies DataTableColumn<RefCaseType>[]) as unknown as DataTableColumn<unknown>[];
}

function ActiveBadge({ active }: { active: boolean }): JSX.Element {
  return active ? <Badge tone="success">نشط</Badge> : <Badge tone="neutral">معطل</Badge>;
}

const REGION_LABELS: Record<RefGovernorate['region'], string> = {
  cairo: 'القاهرة الكبرى',
  delta: 'الدلتا',
  canal: 'القناة',
  upper: 'الصعيد',
  frontier: 'الحدودية',
};
const FACULTY_LABELS: Record<RefSpecialization['facultyType'], string> = {
  civil: 'مدنية',
  military: 'عسكرية',
  sciences: 'علوم',
};
const APPLICABLE_LABELS: Record<RefRank['applicableTo'], string> = {
  officer: 'ضابط',
  enlisted: 'عسكري',
  civilian: 'مدني',
};
const COLLEGE_TYPE_LABELS: Record<RefCollege['type'], string> = {
  public: 'حكومي',
  private: 'خاص',
  azhar: 'أزهر',
};
const QUAL_LEVEL_LABELS: Record<RefQualification['level'], string> = {
  diploma: 'دبلوم',
  bachelor: 'بكالوريوس',
  master: 'ماجستير',
  phd: 'دكتوراه',
};
const RELATION_SIDE_LABELS: Record<RefRelationship['side'], string> = {
  paternal: 'الأب',
  maternal: 'الأم',
  spouse: 'الزوج/الزوجة',
  self: 'نفسه',
};
const SEVERITY_LABELS: Record<RefCaseType['severity'], string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'مرتفعة',
};

/* ───────────────── form drawer ───────────────── */

interface DrawerProps {
  tab: ReferenceTab;
  open: boolean;
  editing: RowBase | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}

function ReferenceFormDrawer({ tab, open, editing, onClose, onSubmit }: DrawerProps): JSX.Element {
  const [draft, setDraft] = useState<Record<string, unknown>>(
    () => (editing ? (editing as unknown as Record<string, unknown>) : defaultPayload(tab)),
  );

  /* Reset draft when re-opening with a different row. */
  if (open && editing && draft.id !== editing.id) setDraft(editing as unknown as Record<string, unknown>);
  if (open && !editing && draft.id) setDraft(defaultPayload(tab));

  const set = (key: string, value: unknown): void => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editing ? `تعديل · ${REFERENCE_TAB_LABELS[tab]}` : `إضافة · ${REFERENCE_TAB_LABELS[tab]}`}
      size="sm"
    >
      <Drawer.Body>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(draft);
          }}
        >
          <Input
            label="الاسم بالعربية"
            required
            value={(draft.nameAr as string) ?? ''}
            onChange={(e) => set('nameAr', e.target.value)}
          />
          {(tab === 'governorates' || tab === 'nationalities') && (
            <Input
              label="الاسم بالإنجليزية"
              value={(draft.nameEn as string) ?? ''}
              onChange={(e) => set('nameEn', e.target.value)}
            />
          )}
          {tab === 'governorates' && (
            <Select
              label="الإقليم"
              value={(draft.region as string) ?? 'cairo'}
              onChange={(e) => set('region', e.target.value)}
              options={Object.entries(REGION_LABELS).map(([value, label]) => ({ value, label }))}
            />
          )}
          {tab === 'specializations' && (
            <>
              <Input
                label="كود التخصص"
                value={(draft.code as string) ?? ''}
                onChange={(e) => set('code', e.target.value)}
              />
              <Select
                label="نوع الكلية"
                value={(draft.facultyType as string) ?? 'civil'}
                onChange={(e) => set('facultyType', e.target.value)}
                options={Object.entries(FACULTY_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </>
          )}
          {tab === 'ranks' && (
            <>
              <Input
                label="المستوى"
                type="number"
                value={(draft.level as number) ?? 1}
                onChange={(e) => set('level', Number(e.target.value))}
              />
              <Select
                label="الفئة"
                value={(draft.applicableTo as string) ?? 'officer'}
                onChange={(e) => set('applicableTo', e.target.value)}
                options={Object.entries(APPLICABLE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </>
          )}
          {tab === 'colleges' && (
            <>
              <Input
                label="رمز المحافظة"
                value={(draft.governorateId as string) ?? ''}
                onChange={(e) => set('governorateId', e.target.value)}
              />
              <Select
                label="النوع"
                value={(draft.type as string) ?? 'public'}
                onChange={(e) => set('type', e.target.value)}
                options={Object.entries(COLLEGE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </>
          )}
          {tab === 'qualifications' && (
            <>
              <Select
                label="المستوى"
                value={(draft.level as string) ?? 'diploma'}
                onChange={(e) => set('level', e.target.value)}
                options={Object.entries(QUAL_LEVEL_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <ToggleField
                label="يلزم تحديد تخصص"
                checked={Boolean(draft.facultyRequired)}
                onChange={(v) => set('facultyRequired', v)}
              />
            </>
          )}
          {tab === 'nationalities' && (
            <Input
              label="ISO Code"
              value={(draft.isoCode as string) ?? ''}
              onChange={(e) => set('isoCode', e.target.value)}
            />
          )}
          {tab === 'relationships' && (
            <>
              <Select
                label="الدرجة"
                value={String((draft.degree as number) ?? 1)}
                onChange={(e) => set('degree', Number(e.target.value))}
                options={[1, 2, 3, 4].map((d) => ({ value: String(d), label: String(d) }))}
              />
              <Select
                label="الجهة"
                value={(draft.side as string) ?? 'paternal'}
                onChange={(e) => set('side', e.target.value)}
                options={Object.entries(RELATION_SIDE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </>
          )}
          {tab === 'case-types' && (
            <>
              <Select
                label="درجة الخطورة"
                value={(draft.severity as string) ?? 'low'}
                onChange={(e) => set('severity', e.target.value)}
                options={Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <ToggleField
                label="يحجب الطلب"
                checked={Boolean(draft.blocksApplication)}
                onChange={(v) => set('blocksApplication', v)}
              />
            </>
          )}
          {(tab === 'governorates' ||
            tab === 'specializations' ||
            tab === 'colleges') && (
            <ToggleField
              label="نشط"
              checked={Boolean(draft.active ?? true)}
              onChange={(v) => set('active', v)}
            />
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary">
              {editing ? 'حفظ' : 'إضافة'}
            </Button>
          </div>
        </form>
      </Drawer.Body>
    </Drawer>
  );
}

function defaultPayload(tab: ReferenceTab): Record<string, unknown> {
  const base = { id: '', nameAr: '' };
  if (tab === 'governorates') return { ...base, nameEn: '', region: 'cairo', active: true };
  if (tab === 'specializations') return { ...base, code: '', facultyType: 'civil', active: true };
  if (tab === 'ranks') return { ...base, level: 1, applicableTo: 'officer' };
  if (tab === 'colleges') return { ...base, governorateId: 'GOV-01', type: 'public', active: true };
  if (tab === 'qualifications') return { ...base, level: 'diploma', facultyRequired: false };
  if (tab === 'nationalities') return { ...base, nameEn: '', isoCode: '' };
  if (tab === 'relationships') return { ...base, degree: 1, side: 'paternal' };
  return { ...base, severity: 'low', blocksApplication: false };
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-sm">
      <span className="text-ink-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-teal-500"
      />
    </label>
  );
}
