/**
 * CommitteeSchedulePage — /admin/committee/schedule
 *
 * Exam-date capacity surface. Four tabs scope the view to one
 * applicant category at a time. The form at the top of each panel
 * adds one schedule entry per committee in that category for the
 * chosen date; the table beneath lists every entry already scheduled
 * for the category.
 *
 * Tab labels are display-facing strings the user asked for; they map
 * to the canonical `ApplicantCategoryKey` set on Committee rows.
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  DatePicker,
  EmptyState,
  Input,
  PageHeader,
  Tabs,
  toast,
} from '@/shared/components';
import type {
  DataTableColumn,
  DataTableSort,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { date as fmtDate, num } from '@/shared/lib/format';
import {
  useCommittees,
  useAddScheduleBatchMutation,
  useRemoveScheduleEntryMutation,
  useScheduleByCategory,
} from '../api/committee.queries';
import {
  type ApplicantCategoryKey,
  type Committee,
  type ExamScheduleEntry,
} from '@/shared/types/domain';

interface ScheduleTab {
  key: ApplicantCategoryKey;
  labelAr: string;
}

/** Tab strip — display labels per the spec, mapped one-to-one to the
 *  canonical ApplicantCategoryKey set. */
const TABS: readonly ScheduleTab[] = [
  { key: 'officers_general',             labelAr: 'القسم العام' },
  { key: 'specialized_officers',         labelAr: 'الضباط المتخصصين' },
  { key: 'law_bachelor',                 labelAr: 'الحقوقيين' },
  { key: 'physical_education_bachelor',  labelAr: 'تربية رياضية إناث' },
];

function isTabKey(v: string | null): v is ApplicantCategoryKey {
  if (!v) return false;
  return TABS.some((t) => t.key === v);
}

/** Convert a Date → ISO yyyy-mm-dd (date-only, no UTC drift). */
function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CommitteeSchedulePage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedKey = searchParams.get('tab');
  const activeKey: ApplicantCategoryKey = isTabKey(requestedKey)
    ? requestedKey
    : TABS[0]!.key;

  const handleTabChange = (next: string): void => {
    if (!isTabKey(next)) return;
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set('tab', next);
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <CenteredShell>
      <PageHeader
        title="مواعيد الاختبارات"
        subtitle="حدّد تاريخ الاختبار والسعة لكل فئة — يُضاف موعد لكل لجنة تابعة للفئة."
      />

      <Card className="mt-3">
        <Tabs value={activeKey} onValueChange={handleTabChange}>
          <Tabs.List aria-label="فئات الاختبارات">
            {TABS.map((tab) => (
              <Tabs.Tab key={tab.key} value={tab.key}>
                {tab.labelAr}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {TABS.map((tab) => (
            <Tabs.Panel key={tab.key} value={tab.key}>
              <div className="pt-3">
                <CategoryPanel categoryKey={tab.key} categoryLabel={tab.labelAr} />
              </div>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Card>
    </CenteredShell>
  );
}

/* ── Per-category panel — form + table ─────────────────────────────── */

interface CategoryPanelProps {
  categoryKey: ApplicantCategoryKey;
  categoryLabel: string;
}

function CategoryPanel({ categoryKey, categoryLabel }: CategoryPanelProps): JSX.Element {
  const committeesQuery = useCommittees();
  const scheduleQuery = useScheduleByCategory(categoryKey);
  const addBatchMut = useAddScheduleBatchMutation();
  const removeMut = useRemoveScheduleEntryMutation();

  const allCommittees = committeesQuery.data ?? [];
  const categoryCommittees = useMemo<Committee[]>(
    () => allCommittees.filter((c) => c.categoryKey === categoryKey && !c.deletedAt),
    [allCommittees, categoryKey],
  );

  const committeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCommittees) map.set(c.id, c.name);
    return map;
  }, [allCommittees]);

  /* ── Form state ───────────────────────────────────────────────── */
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [capacityStr, setCapacityStr] = useState<string>('');

  const capacity = Number(capacityStr);
  const capacityValid =
    capacityStr.length > 0 &&
    Number.isInteger(capacity) &&
    capacity >= 1 &&
    capacity <= 999;
  const dateValid = pickedDate !== null;
  const canSubmit = dateValid && capacityValid && categoryCommittees.length > 0;

  const handleAdd = async (): Promise<void> => {
    if (!canSubmit || !pickedDate) return;
    const iso = toIsoDate(pickedDate);
    try {
      const created = await addBatchMut.mutateAsync({
        categoryKey,
        date: iso,
        capacity,
      });
      toast(
        `تمت إضافة ${num(created.length)} لجنة بتاريخ ${fmtDate(iso, 'full')}`,
        'success',
      );
      setPickedDate(null);
      setCapacityStr('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذّر إضافة المواعيد';
      toast(message, 'danger');
    }
  };

  const handleRemove = (entry: ExamScheduleEntry): void => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('سيتم حذف هذا الموعد. هل تريد المتابعة؟');
      if (!ok) return;
    }
    removeMut.mutate(
      { id: entry.id, categoryKey },
      {
        onSuccess: () => toast('تم حذف الموعد', 'success'),
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  /* ── Table ────────────────────────────────────────────────────── */
  const [sort, setSort] = useState<DataTableSort<ExamScheduleEntry> | null>({
    key: 'date',
    direction: 'asc',
  });

  const entries = scheduleQuery.data ?? [];

  const columns: DataTableColumn<ExamScheduleEntry>[] = [
    {
      key: 'committee',
      label: 'اللجنة',
      render: (e) => (
        <span className="text-2xs text-ink-900">
          {committeeNameById.get(e.committeeId) ?? e.committeeId}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'تاريخ الاختبار',
      sortable: true,
      render: (e) => (
        <span className="font-numeric tnum text-2xs text-ink-700">
          {fmtDate(e.date, 'full')}
        </span>
      ),
    },
    {
      key: 'capacity',
      label: 'سعة اللجنة',
      sortable: true,
      numeric: true,
      render: (e) => <span className="font-numeric tnum">{num(e.capacity)}</span>,
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (e) => (
        <button
          type="button"
          aria-label="حذف الموعد"
          onClick={() => handleRemove(e)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-500 transition-colors hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden />
        </button>
      ),
    },
  ];

  const sorted = useMemo(() => {
    if (!sort) return entries;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...entries].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sort.key];
      const bv = (b as unknown as Record<string, unknown>)[sort.key];
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'ar') * dir;
    });
  }, [entries, sort]);

  return (
    <div className="flex flex-col gap-4">
      <Card variant="elevated">
        <CardHeader
          title="إضافة موعد اختبار"
          subtitle={`فئة ${categoryLabel} — يتم إنشاء موعد لكل لجنة (${num(categoryCommittees.length)} لجنة).`}
        />
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]">
          <DatePicker
            label="تاريخ الاختبار"
            required
            value={pickedDate}
            onChange={setPickedDate}
            placeholder="اختر تاريخ الاختبار…"
          />
          <Input
            type="number"
            inputMode="numeric"
            label="سعة اللجنة"
            required
            min={1}
            max={999}
            step={1}
            value={capacityStr}
            onChange={(e) => setCapacityStr(e.target.value)}
            helper="من 1 إلى 999"
          />
          <div className="flex items-end">
            <Button
              variant="primary"
              size="md"
              onClick={handleAdd}
              disabled={!canSubmit || addBatchMut.isPending}
              isLoading={addBatchMut.isPending}
            >
              إضافة
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <DataTable
          data={sorted}
          columns={columns}
          rowKey={(e) => e.id}
          loading={scheduleQuery.isLoading}
          sort={sort}
          onSortChange={setSort}
          empty={
            <EmptyState
              variant="generic"
              title="لم تُضف مواعيد اختبارات بعد"
              description="استخدم النموذج أعلاه لإضافة أول موعد لهذه الفئة."
            />
          }
          zebraStripes
        />
      </Card>
    </div>
  );
}
