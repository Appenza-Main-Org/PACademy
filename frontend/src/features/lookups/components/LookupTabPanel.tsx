/**
 * LookupTabPanel — the body of one tab on the lookups hub.
 *
 * Toolbar (search + filter), DataTable with per-key columns, "إضافة" button
 * that opens the LookupRowDrawer for create/edit, AlertDialog confirmation
 * on delete with FK-reference reason surfacing when the service blocks.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, MoreVertical, Plus, Search } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import {
  AlertDialog,
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  EmptyState,
  Input,
  Select,
  StatusBadge,
  Switch,
  toast,
  type DataTableColumn,
  type DataTableSort,
} from '@/shared/components';
import { normalizeArabic } from '@/shared/lib/arabic';
import { cn } from '@/shared/lib/cn';
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
  type SchoolCategoryRow,
  type SpecializationRow,
  type SubmissionTypeRow,
  type TestResultRow,
  type TestRow,
  type ApplicantCategoryRow,
} from '../types';
import { readGradingMode } from '../lib/submissionType';
import { GRADING_MODE_LABELS_AR } from '../lib/gradingModes';
import { LookupRowDrawer } from './LookupRowDrawer';

export interface LookupTabPanelProps<K extends LookupKey> {
  lookupKey: K;
}

interface LookupLabelRow {
  code: string;
  name: string;
  parentCode?: string | null;
}

type LookupLabelSources = Partial<Record<LookupKey, readonly LookupLabelRow[]>>;

function defaultSortFor<K extends LookupKey>(lookupKey: K): DataTableSort<LookupRow<K>> {
  return {
    key: (lookupKey === 'tests' ? 'order' : 'name') as keyof LookupRow<K> & string,
    direction: 'asc',
  };
}

export function LookupTabPanel<K extends LookupKey>({ lookupKey }: LookupTabPanelProps<K>): JSX.Element {
  const meta = LOOKUP_META[lookupKey];
  const listQuery = useLookup(lookupKey);
  const createMut = useCreateLookupRow(lookupKey);
  const updateMut = useUpdateLookupRow(lookupKey);
  const deleteMut = useDeleteLookupRow(lookupKey);
  const governoratesQuery = useLookup('governorates');
  const jobsQuery = useLookup('jobs');
  const applicantCategoriesQuery = useLookup('applicant-categories');
  const facultiesQuery = useLookup('faculties');
  const relationshipsQuery = useLookup('relationships');
  const excellenceCriteriaQuery = useLookup('excellence-criteria');
  const applicantDivisionsQuery = useLookup('applicant-divisions');

  const [search, setSearch] = useState('');
  const [filterValue, setFilterValue] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LookupRow<K> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LookupRow<K> | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null);
  const [sort, setSort] = useState<DataTableSort<LookupRow<K>> | null>(() =>
    defaultSortFor(lookupKey),
  );
  const lookupSources = useMemo<LookupLabelSources>(
    () => ({
      governorates: governoratesQuery.data as readonly LookupLabelRow[] | undefined,
      jobs: jobsQuery.data as readonly LookupLabelRow[] | undefined,
      'applicant-categories': applicantCategoriesQuery.data as readonly LookupLabelRow[] | undefined,
      faculties: facultiesQuery.data as readonly LookupLabelRow[] | undefined,
      relationships: relationshipsQuery.data as readonly LookupLabelRow[] | undefined,
      'excellence-criteria': excellenceCriteriaQuery.data as readonly LookupLabelRow[] | undefined,
      'applicant-divisions': applicantDivisionsQuery.data as readonly LookupLabelRow[] | undefined,
    }),
    [
      applicantCategoriesQuery.data,
      applicantDivisionsQuery.data,
      excellenceCriteriaQuery.data,
      facultiesQuery.data,
      governoratesQuery.data,
      jobsQuery.data,
      relationshipsQuery.data,
    ],
  );
  const labelByCode = useCallback(
    (key: LookupKey, code: string): string => {
      const row = lookupSources[key]?.find((item) => item.code === code);
      return row ? row.name : '—';
    },
    [lookupSources],
  );

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
    if (sort) {
      const { key, direction } = sort;
      /* committees: sort by the resolved category label (Arabic name)
       * rather than the raw code, then tie-break by the committee name
       * so rows within the same category remain alphabetically ordered. */
      if (lookupKey === 'committees' && key === 'applicantCategoryId') {
        filtered = [...filtered].sort((a, b) => {
          const ar = a as unknown as CommitteeRow;
          const br = b as unknown as CommitteeRow;
          const primary = compareLookupValues(
            labelByCode('applicant-categories', ar.applicantCategoryId),
            labelByCode('applicant-categories', br.applicantCategoryId),
            direction,
          );
          if (primary !== 0) return primary;
          return compareLookupValues(ar.name, br.name, 'asc');
        });
      } else {
        filtered = [...filtered].sort((a, b) =>
          compareLookupValues(
            (a as unknown as Record<string, unknown>)[key],
            (b as unknown as Record<string, unknown>)[key],
            direction,
          ),
        );
      }
    }
    return filtered;
  }, [labelByCode, listQuery.data, search, filterValue, lookupKey, sort]);

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

  const handleToggleActive = (row: LookupRow<K>): void => {
    const nextActive = !row.isActive;
    updateMut.mutate(
      {
        code: row.code,
        patch: { isActive: nextActive } as Partial<LookupRow<K>>,
      },
      {
        onSuccess: () => {
          toast(
            nextActive ? `تم تفعيل «${row.name}»` : `تم إلغاء تفعيل «${row.name}»`,
            'success',
          );
        },
      },
    );
  };

  const confirmDelete = (): void => {
    if (!pendingDelete) return;
    deleteMut.mutate({ code: pendingDelete.code }, {
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

  const confirmForceDelete = (): void => {
    if (!pendingDelete) return;
    deleteMut.mutate(
      { code: pendingDelete.code, force: true },
      {
        onSuccess: (result) => {
          if (!result.deleted) {
            setDeleteBlocked(result.reason);
            return;
          }
          toast(`تم حذف "${pendingDelete.name}" رغم وجود ارتباطات`, 'success');
          setDeleteBlocked(null);
          setPendingDelete(null);
        },
      },
    );
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

  // Columns close over the row-level handlers above. Handlers reference
  // state setters and TanStack mutate (both stable across renders), so a
  // single rebuild per lookup key is safe.
  const columns = useMemo<DataTableColumn<LookupRow<K>>[]>(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () =>
      buildColumns(
        lookupKey,
        handleEdit,
        handleDelete,
        handleToggleActive,
        labelByCode,
        /* `viewRouteFor` is scoped to applicant-categories — only that
         * lookup currently has a dedicated read-only detail view. Other
         * lookups stay edit-via-drawer only. */
        lookupKey === 'applicant-categories'
          ? (row) =>
              ROUTES.admin.adminLookupsApplicantCategoryDetail(row.code)
          : undefined,
      ),
    [labelByCode, lookupKey],
  );

  const filter = filterDescriptor(lookupKey, lookupSources);

  const totalCount = (listQuery.data ?? []).length;
  const filteredCount = rows.length;
  const isFiltered = filteredCount !== totalCount;
  const hasActiveQuery = search.trim().length > 0 || filterValue !== 'all';
  /* The applicant-categories list is short and hand-curated — the team
   * dropped the count chip there because it adds visual noise without
   * earning its keep. Every other lookup keeps the counter. */
  const showRecordCount = lookupKey !== 'applicant-categories';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="ابحث في السجلات"
          placeholder="ابحث بالاسم…"
          leadingIcon={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          containerClassName="min-w-72 flex-1 max-w-sm"
        />
        {filter && (
          <Select
            aria-label={filter.label}
            value={filterValue}
            onChange={(e) => setFilterValue(e.currentTarget.value)}
            options={[{ value: 'all', label: filter.label }, ...filter.options]}
            containerClassName="min-w-52"
          />
        )}
        {showRecordCount && (
          <span
            aria-live="polite"
            className="ms-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-page px-2.5 text-2xs text-ink-600"
          >
            <span className="font-mono font-medium text-ink-900">{filteredCount}</span>
            <span>سجل</span>
            {isFiltered && (
              <>
                <span className="text-ink-300">·</span>
                <span className="text-ink-500">من {totalCount}</span>
              </>
            )}
          </span>
        )}
        <Button
          variant="primary"
          leadingIcon={<Plus size={16} />}
          onClick={handleAdd}
          aria-label={`إضافة سجل جديد إلى ${meta.label}`}
          className={cn(!showRecordCount && 'ms-auto')}
        >
          إضافة
        </Button>
      </div>

      <DataTable<LookupRow<K>>
        data={rows}
        columns={columns}
        rowKey={(row) => row.code}
        loading={listQuery.isLoading}
        density="default"
        stickyHeader
        sort={sort}
        onSortChange={setSort}
        empty={
          hasActiveQuery ? (
            <EmptyState
              variant="no-results-search"
              title="لا توجد نتائج مطابقة"
              description="جرّب تعديل البحث أو إزالة عوامل التصفية."
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setFilterValue('all');
                  }}
                >
                  إعادة تعيين
                </Button>
              }
            />
          ) : (
            <EmptyState
              variant="generic"
              title="لا توجد سجلات بعد"
              description={`ابدأ بإضافة أول سجل في «${meta.label}».`}
              action={
                <Button variant="primary" size="sm" leadingIcon={<Plus size={14} />} onClick={handleAdd}>
                  إضافة
                </Button>
              }
            />
          )
        }
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
        description={pendingDelete ? `سيتم حذف "${pendingDelete.name}". لا يمكن التراجع.` : ''}
        actionLabel="حذف"
        cancelLabel="إلغاء"
        tone="danger"
        isActionLoading={deleteMut.isPending}
        onAction={confirmDelete}
      />
      <AlertDialog
        open={deleteBlocked !== null}
        onOpenChange={(next) => { if (!next) { setDeleteBlocked(null); setPendingDelete(null); } }}
        title="السجل مرتبط ببيانات أخرى"
        description={deleteBlocked ?? ''}
        actionLabel="حذف على أي حال"
        cancelLabel="إلغاء"
        tone="danger"
        isActionLoading={deleteMut.isPending}
        actionLoadingLabel="جارٍ الحذف…"
        onAction={confirmForceDelete}
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

function rowsFor(key: LookupKey, sources: LookupLabelSources): readonly LookupLabelRow[] {
  return sources[key] ?? [];
}

function filterDescriptor(key: LookupKey, sources: LookupLabelSources): FilterDescriptor | null {
  switch (key) {
    case 'police-stations':
      return {
        label: 'تصفية بالمحافظة',
        field: 'governorateCode',
        options: rowsFor('governorates', sources).map((g) => ({ value: g.code, label: g.name })),
      };
    case 'jobs':
      return {
        label: 'تصفية بالفئة',
        field: 'parentCode',
        options: [
          { value: 'roots', label: 'فئات فقط' },
          ...rowsFor('jobs', sources)
            .filter((j) => j.parentCode === null)
            .map((j) => ({ value: j.code, label: j.name })),
        ],
      };
    case 'announcements':
      return {
        label: 'تصفية بالفئة',
        field: 'categoryCode',
        options: rowsFor('applicant-categories', sources).map((c) => ({ value: c.code, label: c.name })),
      };
    case 'specializations':
      return {
        label: 'تصفية بالكلية',
        field: 'facultyCode',
        options: rowsFor('faculties', sources).map((f) => ({ value: f.code, label: f.name })),
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
  onToggleActive: (row: LookupRow<K>) => void,
  labelByCode: (key: LookupKey, code: string) => string,
  viewRouteFor?: (row: LookupRow<K>) => string,
): DataTableColumn<LookupRow<K>>[] {
  const nameCol: DataTableColumn<LookupRow<K>> = {
    key: 'name',
    label: 'الاسم',
    sortable: true,
    getSortValue: (row) => row.name,
    filter: { kind: 'text', getValue: (row) => row.name },
    render: (row) => {
      const href = viewRouteFor?.(row);
      if (href) {
        return (
          <Link
            to={href}
            className="font-medium text-teal-700 transition-colors duration-fast ease-standard hover:text-teal-800 hover:underline focus-visible:outline-none focus-visible:shadow-[var(--ring)]"
          >
            {row.name}
          </Link>
        );
      }
      return <span className="font-medium text-ink-900">{row.name}</span>;
    },
  };
  const activeCol: DataTableColumn<LookupRow<K>> = {
    key: 'isActive',
    label: 'الحالة',
    sortable: true,
    width: 130,
    getSortValue: (row) => (row.isActive ? 1 : 0),
    filter: {
      kind: 'enum',
      getValue: (row) => (row.isActive ? 'active' : 'inactive'),
      options: [
        { value: 'active', label: 'نشط' },
        { value: 'inactive', label: 'غير نشط' },
      ],
    },
    render: (row) => (
      <span
        className="inline-flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Switch
          checked={row.isActive}
          onCheckedChange={() => onToggleActive(row)}
          aria-label={
            row.isActive
              ? `إلغاء تفعيل «${row.name}»`
              : `تفعيل «${row.name}»`
          }
        />
        <span
          className={cn(
            'text-2xs font-medium',
            row.isActive ? 'text-accent-700' : 'text-ink-500',
          )}
        >
          {row.isActive ? 'نشط' : 'غير نشط'}
        </span>
      </span>
    ),
  };
  const actionsCol: DataTableColumn<LookupRow<K>> = {
    key: 'actions',
    label: <span className="sr-only">إجراءات</span>,
    /* Widen when the eye-icon view button is present so the dropdown
     * trigger doesn't get squeezed against the row edge. */
    width: viewRouteFor ? 96 : 56,
    align: 'end',
    render: (row) => (
      <span
        className="inline-flex items-center justify-end gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {viewRouteFor && (
          <Link
            to={viewRouteFor(row)}
            aria-label={`عرض تفاصيل «${row.name}»`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors duration-fast ease-standard hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-none focus-visible:shadow-[var(--ring)]"
          >
            <Eye size={16} strokeWidth={1.75} aria-hidden />
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`إجراءات على «${row.name}»`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors duration-fast ease-standard hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-none focus-visible:shadow-[var(--ring)] data-[state=open]:bg-ink-100 data-[state=open]:text-ink-900"
            >
              <MoreVertical size={16} strokeWidth={1.75} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onSelect={() => onEdit(row)}>تعديل</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item destructive onSelect={() => onDelete(row)}>حذف</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </span>
    ),
  };

  const extras = extrasFor(key, labelByCode);
  return [nameCol, ...extras, activeCol, actionsCol] as DataTableColumn<LookupRow<K>>[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extrasFor(
  key: LookupKey,
  labelByCode: (key: LookupKey, code: string) => string,
): DataTableColumn<any>[] {
  switch (key) {
    case 'relationships': {
      const govNamesForBranch: Record<string, string> = {
        paternal: 'من جهة الأب', maternal: 'من جهة الأم', self: 'مباشر', spouse: 'الزوج/الزوجة', none: '—',
      };
      return [
        { key: 'branch', label: 'الفرع',  sortable: true, width: 130, render: (r: RelationshipRow) => <Badge tone="neutral">{govNamesForBranch[r.branch] ?? r.branch}</Badge> },
        { key: 'gender', label: 'النوع',  sortable: true, width: 80,  render: (r: RelationshipRow) => <Badge tone={r.gender === 'male' ? 'info' : r.gender === 'female' ? 'accent' : 'neutral'}>{r.gender === 'male' ? 'ذكر' : r.gender === 'female' ? 'أنثى' : '—'}</Badge> },
        { key: 'degree', label: 'الدرجة', sortable: true, width: 80, numeric: true, render: (r: RelationshipRow) => <span className="font-mono text-xs">{r.degree}</span> },
        { key: 'parent', label: 'الأصل',  sortable: true, accessor: 'parentCode', hideOn: 'sm', render: (r: RelationshipRow) => {
          if (!r.parentCode) return <span className="text-ink-400">—</span>;
          return <span className="text-xs text-ink-600">{labelByCode('relationships', r.parentCode)}</span>;
        } },
      ];
    }
    case 'relationship-degree-tiers':
      return [
        { key: 'degreeRange', label: 'الوصف', sortable: true, render: (r: RelationshipDegreeTierRow) => r.degreeRange },
        { key: 'maxDegree', label: 'أقصى درجة', sortable: true, width: 110, numeric: true, render: (r: RelationshipDegreeTierRow) => r.maxDegree },
      ];
    case 'tests':
      return [
        { key: 'order',    label: 'الترتيب', sortable: true, width: 80,  numeric: true, render: (r: TestRow) => r.order },
        { key: 'required', label: 'إلزامي',  sortable: true, width: 90,  render: (r: TestRow) => r.required ? <Badge tone="success">إلزامي</Badge> : <Badge tone="neutral">اختياري</Badge> },
        { key: 'instructions', label: 'التعليمات', width: 110, render: (r: TestRow) => {
          const ins = r.instructions;
          const hasText = ins?.mode === 'text' && !!ins.bodyAr && ins.bodyAr.trim().length > 0;
          const hasPdf  = ins?.mode === 'pdf'  && !!ins.document;
          if (hasText) return <Badge tone="neutral">نص</Badge>;
          if (hasPdf)  return <Badge tone="accent">PDF</Badge>;
          return <span className="text-ink-400">—</span>;
        } },
      ];
    case 'test-results':
      return [
        { key: 'outcome', label: 'النتيجة', sortable: true, width: 120, render: (r: TestResultRow) => <Badge tone={r.tone}>{r.name}</Badge> },
      ];
    case 'committees':
      return [
        { key: 'applicantCategoryId', label: 'فئات المتقدمين', sortable: true, render: (r: CommitteeRow) => labelByCode('applicant-categories', r.applicantCategoryId) },
      ];
    case 'specializations':
      return [
        { key: 'facultyCode', label: 'الكلية', sortable: true, render: (r: SpecializationRow) => labelByCode('faculties', r.facultyCode) },
      ];
    case 'submission-types':
      return [
        { key: 'gradingMode', label: 'طريقة الاحتساب', width: 130, render: (r: SubmissionTypeRow) => {
          const mode = readGradingMode(r);
          return <Badge tone={mode === 'GRADES' ? 'info' : 'accent'}>{GRADING_MODE_LABELS_AR[mode]}</Badge>;
        } },
      ];
    case 'applicant-categories':
      return [
        { key: 'genderScope', label: 'نطاق النوع', width: 150, render: (r: ApplicantCategoryRow) => (
          <span className="inline-flex flex-wrap items-center gap-1">
            {r.genderScope.length === 0
              ? <span className="text-ink-400">—</span>
              : r.genderScope.map((g) => (
                  <Badge key={g} tone={g === 'male' ? 'info' : 'accent'}>
                    {g === 'male' ? 'ذكور' : 'إناث'}
                  </Badge>
                ))}
          </span>
        ) },
        { key: 'type', label: 'مرحلة الالتحاق', sortable: true, width: 110, render: (r: ApplicantCategoryRow) => (
          <Badge tone={r.type === 'university' ? 'info' : 'neutral'}>
            {r.type === 'university' ? 'جامعي' : 'ثانوي'}
          </Badge>
        ) },
        { key: 'minAge', label: 'الحد الأدنى للسن', sortable: true, width: 120, render: (r: ApplicantCategoryRow) => (
          <span className="font-mono text-sm text-ink-900">{r.minAge ?? 17}</span>
        ) },
        /* معيار التمييز* — admins pick a single criterion per category
         * from the `excellence-criteria` lookup. Rows without a
         * configured criterion render «غير محدد». The value resolves
         * through the lookup so a label change there flows through
         * here without a code edit. */
        { key: 'excellenceCriterion', label: 'معيار التمييز*', sortable: true, width: 160, render: (r: ApplicantCategoryRow) => {
          if (!r.excellenceCriterion) {
            return <Badge tone="warning">غير محدد</Badge>;
          }
          return <Badge tone="info">{labelByCode('excellence-criteria', r.excellenceCriterion)}</Badge>;
        } },
      ];
    case 'nationalities-countries':
      return [
        { key: 'isArab', label: 'عربية',   sortable: true, width: 90,  render: (r: NationalityCountryRow) => r.isArab ? <Badge tone="success">عربية</Badge> : <Badge tone="neutral">—</Badge> },
      ];
    case 'governorates':
      return [
        { key: 'region', label: 'الإقليم', sortable: true, width: 160, render: (r: GovernorateRow) => <Badge tone="neutral">{r.region}</Badge> },
      ];
    case 'police-stations':
      return [
        { key: 'kind',            label: 'النوع',     sortable: true, width: 90, render: (r: PoliceStationRow) => <Badge tone="neutral">{r.kind}</Badge> },
        { key: 'governorateCode', label: 'المحافظة', sortable: true, render: (r: PoliceStationRow) => labelByCode('governorates', r.governorateCode) },
      ];
    case 'jobs':
      return [
        { key: 'parentCode', label: 'الفئة', sortable: true, render: (r: JobRow) =>
          r.parentCode === null
            ? <Badge tone="brand">فئة</Badge>
            : <span className="text-xs text-ink-600">{labelByCode('jobs', r.parentCode)}</span>
        },
      ];
    case 'qualifications':
      return [
        { key: 'level', label: 'المستوى', sortable: true, width: 130, render: (r: QualificationRow) => <Badge tone="info">{r.level}</Badge> },
        { key: 'track', label: 'المسار',  sortable: true, width: 110, render: (r: QualificationRow) => <Badge tone="neutral">{r.track}</Badge> },
      ];
    case 'announcements':
      return [
        { key: 'gender',       label: 'الجنس',       sortable: true, width: 90,  render: (r: AnnouncementRow) => <Badge tone={r.gender === 'male' ? 'info' : r.gender === 'female' ? 'accent' : 'neutral'}>{r.gender === 'male' ? 'ذكور' : r.gender === 'female' ? 'إناث' : 'الكل'}</Badge> },
        { key: 'categoryCode', label: 'الفئة',       sortable: true, hideOn: 'sm', render: (r: AnnouncementRow) => r.categoryCode ? labelByCode('applicant-categories', r.categoryCode) : <span className="text-ink-400">الكل</span> },
        { key: 'divisionCode', label: 'الشعبة',      sortable: true, hideOn: 'sm', render: (r: AnnouncementRow) => r.divisionCode ? labelByCode('applicant-divisions', r.divisionCode) : <span className="text-ink-400">الكل</span> },
        { key: 'publishAt',    label: 'بداية النشر', sortable: true, hideOn: 'md', render: (r: AnnouncementRow) => <span className="text-xs text-ink-600">{formatIso(r.publishAt)}</span> },
        { key: 'expireAt',     label: 'النهاية',     sortable: true, hideOn: 'md', render: (r: AnnouncementRow) => <span className="text-xs text-ink-600">{r.expireAt ? formatIso(r.expireAt) : <span className="text-ink-400">مفتوح</span>}</span> },
      ];
    case 'nid-missing-reasons':
      return [
        { key: 'requiresUpload', label: 'مستندات', sortable: true, width: 110, render: (r: NidMissingReasonRow) => r.requiresUpload ? <Badge tone="warning">مطلوبة</Badge> : <Badge tone="neutral">—</Badge> },
      ];
    case 'school-categories':
      return [
        {
          key: 'externalGradesImport',
          label: 'مصدر الدرجات',
          sortable: true,
          width: 180,
          render: (r: SchoolCategoryRow) =>
            r.externalGradesImport ? (
              <Badge tone="info">استيراد خارجي</Badge>
            ) : (
              <Badge tone="neutral">إدخال يدوي</Badge>
            ),
        },
      ];
    default:
      return [];
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Generic Arabic-aware comparator used by the column-header sort.
 *  Numbers compare numerically, booleans place `true` first on `asc`,
 *  everything else falls back to a stable `localeCompare('ar')`.
 *  Null / undefined are pushed to the end regardless of direction. */
function compareLookupValues(
  a: unknown,
  b: unknown,
  direction: 'asc' | 'desc',
): number {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  let cmp = 0;
  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b;
  } else if (typeof a === 'boolean' && typeof b === 'boolean') {
    cmp = (a ? 1 : 0) - (b ? 1 : 0);
    // Surface "نشط" (true) at the top on `asc` — feels more natural in the UI.
    cmp = -cmp;
  } else {
    cmp = String(a).localeCompare(String(b), 'ar');
  }
  return direction === 'asc' ? cmp : -cmp;
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
