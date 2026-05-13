/**
 * CommitteeListPage — admin committee directory.
 *
 * Columns: name, فئات المتقدمين, capacity, assigned applicants,
 * remaining capacity, numeric grade range, تقدير range, academic year,
 * status, created date, row actions.
 *
 * Filters: search by name, academic year, status, فئات المتقدمين.
 * Sortable: name, capacity, status, created date.
 *
 * Row actions: view, edit, manage rules (edit + scroll), view
 * applicants, activate / deactivate, delete.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  DropdownMenu,
  EmptyState,
  Input,
  MultiSelect,
  PageHeader,
  Select,
  SoftDeleteDialog,
  StatCard,
  toast,
} from '@/shared/components';
import type { DataTableColumn, DataTableSort, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, num } from '@/shared/lib/format';
import { useAuthStore } from '@/features/auth';
import { MOCK } from '@/shared/mock-data';
import {
  useCommittees,
  useCommitteeDependencies,
  useCommitteeRestore,
  useCommitteeSetStatus,
  useCommitteeSoftDelete,
  useCommitteeSpecializations,
} from '../api/committee.queries';
import type { Committee } from '@/shared/types/domain';

const DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم',
  results: 'نتيجة لجنة',
};

const STATUS_FILTERS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'active', label: 'مفعّلة' },
  { value: 'inactive', label: 'موقوفة' },
  { value: 'full', label: 'مكتملة السعة' },
];

const SPEC_PILL_LIMIT = 2;

export function CommitteeListPage(): JSX.Element {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = userRole === 'super_admin';

  const [includeDeleted, setIncludeDeleted] = useState(false);
  const { data, isLoading } = useCommittees({
    includeDeleted: isSuperAdmin && includeDeleted,
  });
  const { data: specializations = [] } = useCommitteeSpecializations();

  const softDeleteMut = useCommitteeSoftDelete();
  const restoreMut = useCommitteeRestore();
  const setStatusMut = useCommitteeSetStatus();

  const listActions: ListActionsConfig<Committee> = useMemo(
    () => ({
      entityKey: 'committee.list',
      entityLabelAr: 'لجان القبول',
      auditModule: 'committees',
      export: {
        enabled: true,
        formats: ['csv', 'xlsx'],
        filenamePrefix: 'لجان-',
        columns: [
          { key: 'id', labelAr: 'الكود' },
          { key: 'name', labelAr: 'اسم اللجنة' },
          { key: 'applicants', labelAr: 'المتقدمون' },
          { key: 'completed', labelAr: 'منتهية' },
          { key: 'capacity', labelAr: 'السعة الإجمالية' },
          { key: 'capacityPerDay', labelAr: 'السعة اليومية' },
          { key: 'academicYearId', labelAr: 'العام الدراسي' },
          { key: 'linkedCycleId', labelAr: 'الدورة المرتبطة' },
        ],
      },
    }),
    [],
  );

  const [pendingDelete, setPendingDelete] = useState<Committee | null>(null);
  const dependenciesQuery = useCommitteeDependencies(pendingDelete?.id ?? null);

  /* Filters */
  const [search, setSearch] = useState('');
  const [year, setYear] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [specsFilter, setSpecsFilter] = useState<string[]>([]);

  /* Sort + pagination */
  const [sort, setSort] = useState<DataTableSort<Committee> | null>({
    key: 'createdAt',
    direction: 'desc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const allCommittees = data ?? [];

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCommittees) {
      if (c.academicYearId) set.add(c.academicYearId);
    }
    return Array.from(set).sort().reverse();
  }, [allCommittees]);

  const filtered = useMemo(() => {
    const needle = search.trim();
    return allCommittees.filter((c) => {
      if (needle && !c.name.includes(needle)) return false;
      if (year !== 'all' && c.academicYearId !== year) return false;
      if (statusFilter === 'active' && c.status !== 'active') return false;
      if (statusFilter === 'inactive' && c.status !== 'inactive') return false;
      if (statusFilter === 'full') {
        if (c.capacity === undefined || c.applicants < c.capacity) return false;
      }
      if (specsFilter.length > 0) {
        const specs = c.specializationIds ?? [];
        if (!specsFilter.some((s) => specs.includes(s))) return false;
      }
      return true;
    });
  }, [allCommittees, search, year, statusFilter, specsFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sort.key];
      const bv = (b as unknown as Record<string, unknown>)[sort.key];
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'ar') * dir;
    });
  }, [filtered, sort]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const onRestore = (c: Committee): void => {
    restoreMut.mutate(c.id, {
      onSuccess: () => toast(`تم استعادة "${c.name}"`, 'success'),
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  const onToggleStatus = (c: Committee): void => {
    const next = c.status === 'active' ? 'inactive' : 'active';
    setStatusMut.mutate(
      { id: c.id, status: next },
      {
        onSuccess: () =>
          toast(`${next === 'active' ? 'تم تفعيل' : 'تم تعطيل'} "${c.name}"`, 'success'),
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  const specLabel = (specId: string): string =>
    specializations.find((s) => s.id === specId)?.nameAr ?? specId;

  const academicGradeLabel = (code: string | null | undefined): string | null => {
    if (!code) return null;
    return MOCK.lookups['academic-grades'].find((g) => g.code === code)?.name ?? code;
  };

  /* ── Stat row ─────────────────────────────────────────── */
  const totalCapacity = allCommittees.reduce((s, c) => s + (c.capacity ?? 0), 0);
  const totalAssigned = allCommittees.reduce((s, c) => s + c.applicants, 0);
  const activeCount = allCommittees.filter((c) => c.status === 'active').length;
  const fullCount = allCommittees.filter(
    (c) => c.capacity !== undefined && c.applicants >= c.capacity,
  ).length;

  const columns: DataTableColumn<Committee>[] = [
    {
      key: 'name',
      label: 'اسم اللجنة',
      sortable: true,
      render: (c) => (
        <Link
          to={ROUTES.committee.detail(c.id)}
          className="font-medium text-gold-700 hover:underline"
        >
          {c.name}
        </Link>
      ),
    },
    {
      key: 'specializations',
      label: 'فئات المتقدمين',
      render: (c) => {
        const ids = c.specializationIds ?? [];
        if (ids.length === 0) return <span className="text-2xs text-ink-500">—</span>;
        const visible = ids.slice(0, SPEC_PILL_LIMIT);
        const extra = ids.length - visible.length;
        return (
          <div className="flex flex-wrap items-center gap-1">
            {visible.map((id) => (
              <Badge key={id} tone="brand">
                {specLabel(id)}
              </Badge>
            ))}
            {extra > 0 && <Badge tone="neutral">+{extra}</Badge>}
          </div>
        );
      },
      hideOn: 'sm',
    },
    {
      key: 'capacity',
      label: 'السعة',
      sortable: true,
      numeric: true,
      render: (c) => num(c.capacity ?? '—'),
    },
    {
      key: 'applicants',
      label: 'المسنّد',
      numeric: true,
      render: (c) => num(c.applicants),
    },
    {
      key: 'remaining',
      label: 'المتبقي',
      numeric: true,
      render: (c) => {
        const cap = c.capacity ?? 0;
        const remaining = Math.max(0, cap - c.applicants);
        const isFull = cap > 0 && c.applicants >= cap;
        return (
          <span className={isFull ? 'font-bold text-terra-600' : 'text-ink-900'}>
            {cap > 0 ? num(remaining) : '—'}
          </span>
        );
      },
    },
    {
      key: 'gradeRange',
      label: 'نطاق الدرجات',
      hideOn: 'md',
      render: (c) => {
        const f = c.rules?.gradeFrom ?? null;
        const t = c.rules?.gradeTo ?? null;
        if (f == null && t == null) return <span className="text-2xs text-ink-500">—</span>;
        return (
          <span className="font-mono text-xs" dir="ltr">
            {f ?? '—'}–{t ?? '—'}
          </span>
        );
      },
    },
    {
      key: 'academicGradeRange',
      label: 'نطاق التقدير',
      hideOn: 'md',
      render: (c) => {
        const f = academicGradeLabel(c.rules?.academicGradeFromId);
        const t = academicGradeLabel(c.rules?.academicGradeToId);
        if (!f && !t) return <span className="text-2xs text-ink-500">—</span>;
        return <span className="text-xs">{f ?? '—'} – {t ?? '—'}</span>;
      },
    },
    {
      key: 'academicYearId',
      label: 'العام الدراسي',
      hideOn: 'md',
      render: (c) => c.academicYearId ?? <span className="text-2xs text-ink-500">—</span>,
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: true,
      render: (c) => {
        if (c.deletedAt) return <Badge tone="warning">محذوف</Badge>;
        const isFull =
          c.capacity !== undefined && c.applicants >= c.capacity;
        if (isFull) return <Badge tone="danger">مكتمل</Badge>;
        if (c.status === 'inactive') return <Badge tone="neutral">موقوفة</Badge>;
        return <Badge tone="success">مفعّلة</Badge>;
      },
    },
    {
      key: 'createdAt',
      label: 'تاريخ الإنشاء',
      sortable: true,
      hideOn: 'md',
      render: (c) =>
        c.createdAt ? (
          <span className="text-2xs text-ink-500">{fmtDate(c.createdAt, 'short')}</span>
        ) : (
          <span className="text-2xs text-ink-500">—</span>
        ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (c) => {
        const deleted = Boolean(c.deletedAt);
        return (
          <div className="flex items-center justify-end gap-1">
            {isSuperAdmin && deleted && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RotateCcw size={12} strokeWidth={1.75} />}
                onClick={() => onRestore(c)}
                isLoading={restoreMut.isPending}
              >
                استعادة
              </Button>
            )}
            {!deleted && (
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<MoreHorizontal size={14} strokeWidth={1.75} />}
                    aria-label="إجراءات اللجنة"
                  >
                    إجراءات
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item
                    leadingIcon={<ListChecks size={14} strokeWidth={1.75} />}
                    onSelect={() => navigate(ROUTES.committee.detail(c.id))}
                  >
                    عرض التفاصيل
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    leadingIcon={<Pencil size={14} strokeWidth={1.75} />}
                    onSelect={() => navigate(ROUTES.committee.edit(c.id))}
                  >
                    تعديل
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    leadingIcon={<Settings2 size={14} strokeWidth={1.75} />}
                    onSelect={() => navigate(ROUTES.committee.edit(c.id))}
                  >
                    إدارة الشروط
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    leadingIcon={<Users size={14} strokeWidth={1.75} />}
                    onSelect={() => navigate(ROUTES.committee.applicants(c.id))}
                  >
                    عرض المتقدمين
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    leadingIcon={
                      c.status === 'active' ? (
                        <PowerOff size={14} strokeWidth={1.75} />
                      ) : (
                        <Power size={14} strokeWidth={1.75} />
                      )
                    }
                    onSelect={() => onToggleStatus(c)}
                  >
                    {c.status === 'active' ? 'تعطيل' : 'تفعيل'}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    destructive
                    leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
                    onSelect={() => setPendingDelete(c)}
                  >
                    حذف
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="قائمة اللجان"
        subtitle="إدارة لجان القبول، فئاتها، السعة وشروط التوزيع."
        actions={
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <label className="flex items-center gap-2 text-2xs text-ink-500">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-teal-500"
                />
                إظهار المحذوف
              </label>
            )}
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Plus size={14} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.committee.create)}
            >
              إنشاء لجنة
            </Button>
          </div>
        }
      />

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        <StatCard label="عدد اللجان" value={allCommittees.length} />
        <StatCard label="المفعّلة" value={activeCount} />
        <StatCard
          label="السعة الإجمالية"
          value={totalCapacity}
          trend={{
            label: `${num(totalAssigned)} مسنّد`,
            tone: 'neutral',
          }}
        />
        <StatCard
          label="مكتملة السعة"
          value={fullCount}
          trend={{ label: 'لا توزيع تلقائي عليها', tone: fullCount > 0 ? 'danger' : 'neutral' }}
        />
      </div>

      <Card className="mt-5">
        <CardHeader title="الفلاتر والبحث" />
        <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-4">
          <Input
            label="بحث باسم اللجنة"
            placeholder="اكتب جزءاً من الاسم"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            containerClassName="lg:col-span-2"
          />
          <Select
            label="العام الدراسي"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            options={[
              { value: 'all', label: 'كل الأعوام' },
              ...years.map((y) => ({ value: y, label: y })),
            ]}
          />
          <Select
            label="الحالة"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={STATUS_FILTERS}
          />
          <MultiSelect
            label="فئات المتقدمين"
            value={specsFilter}
            onChange={setSpecsFilter}
            options={specializations
              .filter((s) => s.active)
              .map((s) => ({ value: s.id, label: s.nameAr }))}
            placeholder="كل الفئات"
            className="lg:col-span-4"
          />
        </div>
      </Card>

      <Card className="mt-5">
        <DataTable
          data={paged}
          columns={columns}
          rowKey={(c) => c.id}
          loading={isLoading}
          sort={sort}
          onSortChange={(next) => setSort(next)}
          pagination={{
            page,
            pageSize,
            total: sorted.length,
            pageSizeOptions: [10, 25, 50],
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(1);
            },
          }}
          empty={
            <EmptyState
              variant="generic"
              title="لا توجد لجان"
              description="ابدأ بإنشاء أول لجنة قبول لربط فئات المتقدمين بالسعة وشروط التوزيع."
              action={
                <Button
                  variant="primary"
                  leadingIcon={<Plus size={14} strokeWidth={1.75} />}
                  onClick={() => navigate(ROUTES.committee.create)}
                >
                  إنشاء لجنة
                </Button>
              }
            />
          }
          zebraStripes
          listActions={listActions}
        />
      </Card>

      <SoftDeleteDialog
        open={pendingDelete !== null}
        entityNoun="هذه اللجنة"
        entityLabel={pendingDelete?.name ?? ''}
        dependencies={dependenciesQuery.data ?? null}
        dependencyLabels={DEP_LABELS}
        onClose={() => setPendingDelete(null)}
        onConfirm={async (reason) => {
          if (!pendingDelete) return;
          try {
            await softDeleteMut.mutateAsync({ id: pendingDelete.id, reason });
            toast(`تم حذف "${pendingDelete.name}"`, 'success');
          } catch (err) {
            toast((err as Error).message, 'danger');
            throw err;
          }
        }}
      />
    </CenteredShell>
  );
}
