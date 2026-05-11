/**
 * LookupTabPanel — the body of one tab on the lookups hub.
 *
 * Toolbar (search + filter), DataTable with per-key columns, "إضافة" button
 * that opens the LookupRowDrawer for create/edit, AlertDialog confirmation
 * on delete with FK-reference reason surfacing when the service blocks.
 */

import { useMemo, useState } from 'react';
import { MoreVertical, Plus, Search } from 'lucide-react';
import {
  AlertDialog,
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  Input,
  Select,
  StatusBadge,
  toast,
  type DataTableColumn,
} from '@/shared/components';
import { normalizeArabic } from '@/shared/lib/arabic';
import { MOCK } from '@/shared/mock-data';
import {
  useCreateLookupRow,
  useDeleteLookupRow,
  useLookup,
  useUpdateLookupRow,
} from '../api/lookups.queries';
import {
  LOOKUP_META,
  type AnnouncementRow,
  type CommitteeRow,
  type GovernorateRow,
  type JobRow,
  type LookupKey,
  type LookupRow,
  type NationalityCountryRow,
  type NidMissingReasonRow,
  type PoliceStationRow,
  type QualificationRow,
  type RelationshipDegreeTierRow,
  type RelationshipRow,
  type SpecializationRow,
  type TestResultRow,
  type TestRow,
  type ApplicantCategoryRow,
} from '../types';
import { LookupRowDrawer } from './LookupRowDrawer';

export interface LookupTabPanelProps<K extends LookupKey> {
  lookupKey: K;
}

export function LookupTabPanel<K extends LookupKey>({ lookupKey }: LookupTabPanelProps<K>): JSX.Element {
  const meta = LOOKUP_META[lookupKey];
  const listQuery = useLookup(lookupKey);
  const createMut = useCreateLookupRow(lookupKey);
  const updateMut = useUpdateLookupRow(lookupKey);
  const deleteMut = useDeleteLookupRow(lookupKey);

  const [search, setSearch] = useState('');
  const [filterValue, setFilterValue] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LookupRow<K> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LookupRow<K> | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = (listQuery.data ?? []) as LookupRow<K>[];
    const q = search.trim() ? normalizeArabic(search.trim()) : '';
    let filtered = all;
    if (q) {
      filtered = filtered.filter(
        (r) => normalizeArabic(r.name).includes(q) || normalizeArabic(r.code).includes(q),
      );
    }
    filtered = applyKeyFilter(lookupKey, filtered, filterValue);
    return filtered;
  }, [listQuery.data, search, filterValue, lookupKey]);

  const handleAdd = (): void => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const handleEdit = (row: LookupRow<K>): void => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const handleDelete = (row: LookupRow<K>): void => {
    setPendingDelete(row);
  };

  const confirmDelete = (): void => {
    if (!pendingDelete) return;
    deleteMut.mutate(pendingDelete.code, {
      onSuccess: (result) => {
        if (result.deleted) {
          toast(`تم حذف "${pendingDelete.name}"`, 'success');
          setPendingDelete(null);
        } else {
          setDeleteBlocked(result.reason);
        }
      },
    });
  };

  const submit = (values: LookupRow<K>): void => {
    if (editing) {
      updateMut.mutate(
        { code: editing.code, patch: values },
        {
          onSuccess: () => {
            toast(`تم تحديث "${values.name}"`, 'success');
            setDrawerOpen(false);
          },
        },
      );
    } else {
      createMut.mutate(values, {
        onSuccess: () => {
          toast(`تم إضافة "${values.name}"`, 'success');
          setDrawerOpen(false);
        },
      });
    }
  };

  const columns = useMemo<DataTableColumn<LookupRow<K>>[]>(() => buildColumns(lookupKey, handleEdit, handleDelete), [lookupKey]);

  const filter = filterDescriptor(lookupKey);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input
          label="بحث"
          placeholder="ابحث بالكود أو الاسم…"
          leadingIcon={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          containerClassName="min-w-72"
        />
        {filter && (
          <Select
            label={filter.label}
            value={filterValue}
            onChange={(e) => setFilterValue(e.currentTarget.value)}
            options={[{ value: 'all', label: 'الكل' }, ...filter.options]}
            containerClassName="min-w-56"
          />
        )}
        <div className="ms-auto flex items-end gap-2 pb-1">
          <Badge tone="neutral">{`${rows.length} سجل`}</Badge>
          <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={handleAdd}>
            إضافة {meta.label.replace(/^\S+\s*/, '')}
          </Button>
        </div>
      </div>

      <DataTable<LookupRow<K>>
        data={rows}
        columns={columns}
        rowKey={(row) => row.code}
        loading={listQuery.isLoading}
        density="default"
        stickyHeader
        empty={<p className="py-12 text-center text-sm text-ink-500">لا توجد سجلات مطابقة.</p>}
      />

      <LookupRowDrawer
        open={drawerOpen}
        lookupKey={lookupKey}
        editing={editing}
        onClose={() => setDrawerOpen(false)}
        onSubmit={submit}
        submitting={createMut.isPending || updateMut.isPending}
      />

      <AlertDialog
        open={pendingDelete !== null && deleteBlocked === null}
        onOpenChange={(next) => { if (!next) setPendingDelete(null); }}
        title="تأكيد الحذف"
        description={pendingDelete ? `سيتم حذف "${pendingDelete.name}" (${pendingDelete.code}). لا يمكن التراجع.` : ''}
        actionLabel="حذف"
        cancelLabel="إلغاء"
        tone="danger"
        isActionLoading={deleteMut.isPending}
        onAction={confirmDelete}
      />
      <AlertDialog
        open={deleteBlocked !== null}
        onOpenChange={(next) => { if (!next) { setDeleteBlocked(null); setPendingDelete(null); } }}
        title="تعذر الحذف"
        description={deleteBlocked ?? ''}
        actionLabel="إغلاق"
        tone="primary"
        onAction={() => { setDeleteBlocked(null); setPendingDelete(null); }}
      />
    </div>
  );
}

/* ─── Filter descriptors per key ─────────────────────────────────────── */

interface FilterDescriptor {
  label: string;
  field: string;
  options: Array<{ value: string; label: string }>;
}

function filterDescriptor(key: LookupKey): FilterDescriptor | null {
  switch (key) {
    case 'police-stations':
      return {
        label: 'تصفية بالمحافظة',
        field: 'governorateCode',
        options: (MOCK.lookups.governorates as GovernorateRow[]).map((g) => ({ value: g.code, label: g.name })),
      };
    case 'jobs':
      return {
        label: 'تصفية بالفئة',
        field: 'parentCode',
        options: [
          { value: 'roots', label: 'فئات فقط' },
          ...(MOCK.lookups.jobs as JobRow[]).filter((j) => j.parentCode === null).map((j) => ({ value: j.code, label: j.name })),
        ],
      };
    case 'announcements':
      return {
        label: 'تصفية بالفئة',
        field: 'categoryCode',
        options: (MOCK.lookups['applicant-categories'] as ApplicantCategoryRow[]).map((c) => ({ value: c.code, label: c.name })),
      };
    case 'specializations':
      return {
        label: 'تصفية بالكلية',
        field: 'facultyCode',
        options: MOCK.lookups.faculties.map((f) => ({ value: f.code, label: f.name })),
      };
    case 'tests':
      return {
        label: 'تصفية بنوع الاختبار',
        field: 'kind',
        options: [
          { value: 'physical',  label: 'رياضي' },
          { value: 'medical',   label: 'طبي' },
          { value: 'interview', label: 'مقابلة' },
          { value: 'written',   label: 'كتابي' },
          { value: 'psych',     label: 'نفسي' },
        ],
      };
    case 'qualifications':
      return {
        label: 'تصفية بالمستوى',
        field: 'level',
        options: [
          { value: 'ثانوي',     label: 'ثانوي' },
          { value: 'دبلوم',     label: 'دبلوم' },
          { value: 'بكالوريوس', label: 'بكالوريوس' },
          { value: 'ماجستير',   label: 'ماجستير' },
          { value: 'دكتوراه',   label: 'دكتوراه' },
        ],
      };
    case 'governorates':
      return {
        label: 'تصفية بالإقليم',
        field: 'region',
        options: [
          { value: 'القاهرة الكبرى', label: 'القاهرة الكبرى' },
          { value: 'الوجه البحري',   label: 'الوجه البحري' },
          { value: 'الوجه القبلي',   label: 'الوجه القبلي' },
          { value: 'القناة',         label: 'القناة' },
          { value: 'الحدود',         label: 'الحدود' },
        ],
      };
    case 'nationalities-countries':
      return {
        label: 'تصفية',
        field: 'isArab',
        options: [
          { value: 'arab',     label: 'دول عربية فقط' },
          { value: 'non-arab', label: 'غير عربية فقط' },
        ],
      };
    default:
      return null;
  }
}

function applyKeyFilter<K extends LookupKey>(key: K, rows: LookupRow<K>[], value: string): LookupRow<K>[] {
  if (value === 'all') return rows;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = rows as any[];
  switch (key) {
    case 'police-stations':       return r.filter((row) => row.governorateCode === value) as LookupRow<K>[];
    case 'jobs':                  return r.filter((row) => value === 'roots' ? row.parentCode === null : row.parentCode === value) as LookupRow<K>[];
    case 'announcements':         return r.filter((row) => row.categoryCode === value) as LookupRow<K>[];
    case 'specializations':       return r.filter((row) => row.facultyCode === value) as LookupRow<K>[];
    case 'tests':                 return r.filter((row) => row.kind === value) as LookupRow<K>[];
    case 'qualifications':        return r.filter((row) => row.level === value) as LookupRow<K>[];
    case 'governorates':          return r.filter((row) => row.region === value) as LookupRow<K>[];
    case 'nationalities-countries': return r.filter((row) => value === 'arab' ? row.isArab : !row.isArab) as LookupRow<K>[];
    default:                      return rows;
  }
}

/* ─── Per-key column builders ────────────────────────────────────────── */

function buildColumns<K extends LookupKey>(
  key: K,
  onEdit: (row: LookupRow<K>) => void,
  onDelete: (row: LookupRow<K>) => void,
): DataTableColumn<LookupRow<K>>[] {
  const codeCol: DataTableColumn<LookupRow<K>> = {
    key: 'code',
    label: 'الكود',
    width: 130,
    render: (row) => <span className="font-mono text-xs">{row.code}</span>,
  };
  const nameCol: DataTableColumn<LookupRow<K>> = {
    key: 'name',
    label: 'الاسم',
    render: (row) => <span className="font-medium text-ink-900">{row.name}</span>,
  };
  const activeCol: DataTableColumn<LookupRow<K>> = {
    key: 'isActive',
    label: 'الحالة',
    width: 110,
    render: (row) => row.isActive
      ? <Badge tone="success">مفعّل</Badge>
      : <Badge tone="warning">غير مفعّل</Badge>,
  };
  const actionsCol: DataTableColumn<LookupRow<K>> = {
    key: 'actions',
    label: <span className="sr-only">إجراءات</span>,
    width: 56,
    align: 'end',
    render: (row) => (
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="إجراءات"
            className="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <MoreVertical size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onSelect={() => onEdit(row)}>تعديل</DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item destructive onSelect={() => onDelete(row)}>حذف</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    ),
  };

  const extras = extrasFor(key);
  return [codeCol, nameCol, ...extras, activeCol, actionsCol] as DataTableColumn<LookupRow<K>>[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extrasFor(key: LookupKey): DataTableColumn<any>[] {
  switch (key) {
    case 'relationships': {
      const govNamesForBranch: Record<string, string> = {
        paternal: 'من جهة الأب', maternal: 'من جهة الأم', self: 'مباشر', spouse: 'الزوج/الزوجة', none: '—',
      };
      return [
        { key: 'branch', label: 'الفرع',  width: 130, render: (r: RelationshipRow) => <Badge tone="neutral">{govNamesForBranch[r.branch] ?? r.branch}</Badge> },
        { key: 'gender', label: 'النوع',  width: 80,  render: (r: RelationshipRow) => <Badge tone={r.gender === 'male' ? 'info' : r.gender === 'female' ? 'accent' : 'neutral'}>{r.gender === 'male' ? 'ذكر' : r.gender === 'female' ? 'أنثى' : '—'}</Badge> },
        { key: 'degree', label: 'الدرجة', width: 80, numeric: true, render: (r: RelationshipRow) => <span className="font-mono text-xs">{r.degree}</span> },
        { key: 'parent', label: 'الأصل',  hideOn: 'sm', render: (r: RelationshipRow) => {
          if (!r.parentCode) return <span className="text-ink-400">—</span>;
          const p = (MOCK.lookups.relationships as RelationshipRow[]).find((x) => x.code === r.parentCode);
          return <span className="text-xs text-ink-600">{p ? `${p.name} (${p.code})` : r.parentCode}</span>;
        } },
      ];
    }
    case 'relationship-degree-tiers':
      return [
        { key: 'degreeRange', label: 'الوصف', render: (r: RelationshipDegreeTierRow) => r.degreeRange },
        { key: 'maxDegree', label: 'أقصى درجة', width: 110, numeric: true, render: (r: RelationshipDegreeTierRow) => r.maxDegree },
      ];
    case 'tests':
      return [
        { key: 'kind',     label: 'النوع',  width: 110, render: (r: TestRow) => <Badge tone="info">{TEST_KIND_LABEL[r.kind]}</Badge> },
        { key: 'order',    label: 'الترتيب', width: 80,  numeric: true, render: (r: TestRow) => r.order },
        { key: 'required', label: 'إلزامي',  width: 90,  render: (r: TestRow) => r.required ? <Badge tone="success">إلزامي</Badge> : <Badge tone="neutral">اختياري</Badge> },
      ];
    case 'test-results':
      return [
        { key: 'outcome', label: 'النتيجة', width: 120, render: (r: TestResultRow) => <Badge tone={r.tone}>{r.name}</Badge> },
      ];
    case 'committees':
      return [
        { key: 'kind',       label: 'النوع', width: 110, render: (r: CommitteeRow) => <Badge tone="neutral">{COMMITTEE_KIND_LABEL[r.kind]}</Badge> },
        { key: 'chairTitle', label: 'الرئيس', render: (r: CommitteeRow) => r.chairTitle },
      ];
    case 'specializations':
      return [
        { key: 'facultyCode', label: 'الكلية', render: (r: SpecializationRow) => labelByCode('faculties', r.facultyCode) },
      ];
    case 'applicant-categories':
      return [
        { key: 'genderScope', label: 'نطاق النوع', width: 110, render: (r: ApplicantCategoryRow) => <Badge tone={r.genderScope === 'male' ? 'info' : r.genderScope === 'female' ? 'accent' : 'neutral'}>{r.genderScope === 'male' ? 'ذكور' : r.genderScope === 'female' ? 'إناث' : 'الكل'}</Badge> },
        { key: 'applicationMode', label: 'نوع التقديم', width: 120, render: (r: ApplicantCategoryRow) => <Badge tone="neutral">{r.applicationMode === 'general' ? 'عام' : 'بالترشيح'}</Badge> },
      ];
    case 'nationalities-countries':
      return [
        { key: 'iso2',   label: 'ISO',     width: 80,  render: (r: NationalityCountryRow) => <span className="font-mono text-xs">{r.iso2}</span> },
        { key: 'isArab', label: 'عربية',   width: 90,  render: (r: NationalityCountryRow) => r.isArab ? <Badge tone="success">عربية</Badge> : <Badge tone="neutral">—</Badge> },
      ];
    case 'governorates':
      return [
        { key: 'region', label: 'الإقليم', width: 160, render: (r: GovernorateRow) => <Badge tone="neutral">{r.region}</Badge> },
      ];
    case 'police-stations':
      return [
        { key: 'kind',            label: 'النوع',     width: 90, render: (r: PoliceStationRow) => <Badge tone="neutral">{r.kind}</Badge> },
        { key: 'governorateCode', label: 'المحافظة', render: (r: PoliceStationRow) => labelByCode('governorates', r.governorateCode) },
      ];
    case 'jobs':
      return [
        { key: 'parentCode', label: 'الفئة', render: (r: JobRow) =>
          r.parentCode === null
            ? <Badge tone="brand">فئة</Badge>
            : <span className="text-xs text-ink-600">{labelByCode('jobs', r.parentCode)}</span>
        },
      ];
    case 'qualifications':
      return [
        { key: 'level', label: 'المستوى', width: 130, render: (r: QualificationRow) => <Badge tone="info">{r.level}</Badge> },
        { key: 'track', label: 'المسار',  width: 110, render: (r: QualificationRow) => <Badge tone="neutral">{r.track}</Badge> },
      ];
    case 'announcements':
      return [
        { key: 'gender',       label: 'الجنس',   width: 90,  render: (r: AnnouncementRow) => <Badge tone={r.gender === 'male' ? 'info' : r.gender === 'female' ? 'accent' : 'neutral'}>{r.gender === 'male' ? 'ذكور' : r.gender === 'female' ? 'إناث' : 'الكل'}</Badge> },
        { key: 'categoryCode', label: 'الفئة',   hideOn: 'sm', render: (r: AnnouncementRow) => r.categoryCode ? labelByCode('applicant-categories', r.categoryCode) : <span className="text-ink-400">الكل</span> },
        { key: 'divisionCode', label: 'الشعبة',  hideOn: 'sm', render: (r: AnnouncementRow) => r.divisionCode ? labelByCode('applicant-divisions', r.divisionCode) : <span className="text-ink-400">الكل</span> },
        { key: 'publishAt',    label: 'بداية النشر', hideOn: 'md', render: (r: AnnouncementRow) => <span className="text-xs text-ink-600">{formatIso(r.publishAt)}</span> },
        { key: 'expireAt',     label: 'النهاية',     hideOn: 'md', render: (r: AnnouncementRow) => <span className="text-xs text-ink-600">{r.expireAt ? formatIso(r.expireAt) : <span className="text-ink-400">مفتوح</span>}</span> },
      ];
    case 'nid-missing-reasons':
      return [
        { key: 'requiresUpload', label: 'مستندات', width: 110, render: (r: NidMissingReasonRow) => r.requiresUpload ? <Badge tone="warning">مطلوبة</Badge> : <Badge tone="neutral">—</Badge> },
      ];
    default:
      return [];
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const TEST_KIND_LABEL: Record<TestRow['kind'], string> = {
  physical: 'رياضي', medical: 'طبي', interview: 'مقابلة', written: 'كتابي', psych: 'نفسي',
};
const COMMITTEE_KIND_LABEL: Record<CommitteeRow['kind'], string> = {
  primary: 'رئيسية', capacities: 'قدرات', traits: 'سمات', sports: 'رياضية', medical: 'طبية', interview: 'مقابلة', final: 'نهائية',
};

function labelByCode(key: LookupKey, code: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (MOCK.lookups[key] as any[]).find((r) => r.code === code);
  return row ? `${row.name} (${row.code})` : code;
}

function formatIso(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/* Suppress unused-imports warning for StatusBadge — left in place for
 * future tone wiring; no-op render path keeps the import linted. */
void StatusBadge;
