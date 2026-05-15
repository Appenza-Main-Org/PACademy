/**
 * ExamScheduleStep — wizard step 6 body.
 *
 * Renders a per-category tab header above the schedule table for the
 * active tab. Adds per-category bulk-generate, single-day add/edit,
 * and copy-from-category dialogs. Selected category is mirrored in
 * the URL search param `?categoryId=<id>` for deep-linking.
 *
 * Backed by `useActiveCategoriesForCycle` (step 1 master data) and
 * `useExamScheduleDays(cycleId, categoryId)`.
 */

import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle, CalendarPlus, Copy, MoreVertical, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Tabs,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import type { AdmissionCycle } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../../hooks/useAdmissionSetupCycle';
import { useActiveCategoriesForCycle } from '../../lib/activeCategories';
import {
  useExamScheduleAggregate,
  useExamScheduleDays,
} from '../../api/examSchedule.queries';
import type { ActiveCategoryView } from '../../lib/activeCategories';
import type { ExamScheduleDay } from '../../types';
import { BulkGenerateDialog } from './BulkGenerateDialog';
import { DayFormDialog } from './DayFormDialog';
import { DaysTable } from './DaysTable';
import { CopyScheduleDialog } from './CopyScheduleDialog';

function toIsoDate(input: string): string {
  return input.slice(0, 10);
}

export function ExamScheduleStep(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({
  cycle,
  canWrite,
}: {
  cycle: AdmissionCycle;
  canWrite: boolean;
}): JSX.Element {
  const categoriesQuery = useActiveCategoriesForCycle(cycle.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategoryId = searchParams.get('categoryId');

  if (categoriesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (categoriesQuery.isError) {
    return <ErrorState title="تعذّر تحميل الفئات" />;
  }
  const active = categoriesQuery.data ?? [];
  if (active.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد فئات مفعّلة في هذه الدورة"
        description="ارجع إلى الخطوة الأولى لتفعيل الفئات قبل إعداد التقويم."
        action={
          <Link to={ROUTES.admin.admissionSetup.wizard('application_settings')}>
            <Button variant="primary">العودة إلى إعدادات التقديم</Button>
          </Link>
        }
      />
    );
  }

  const activeIds = active.map((c) => c.id);
  const initialId =
    requestedCategoryId && activeIds.includes(requestedCategoryId)
      ? requestedCategoryId
      : active[0]!.id;

  const handleTabChange = (next: string): void => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('categoryId', next);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="مواعيد الاختبارات"
        subtitle="أنشئ تقويم الاختبارات لكل فئة من فئات الدورة المفعّلة."
      />

      <IncompleteCategoriesBanner cycleId={cycle.id} activeIds={activeIds} />

      <Card>
        <Tabs value={initialId} onValueChange={handleTabChange}>
          <Tabs.List aria-label="فئات التقديم المفعّلة">
            {active.map((c) => (
              <CategoryTab key={c.id} category={c} cycleId={cycle.id} />
            ))}
          </Tabs.List>

          {active.map((c) => (
            <Tabs.Panel key={c.id} value={c.id}>
              <div className="pt-2">
                <CategoryPanel
                  cycle={cycle}
                  category={c}
                  candidateSources={active.filter((other) => other.id !== c.id)}
                  canWrite={canWrite}
                />
              </div>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}

function IncompleteCategoriesBanner({
  cycleId,
  activeIds,
}: {
  cycleId: string;
  activeIds: string[];
}): JSX.Element | null {
  const aggregateQuery = useExamScheduleAggregate(cycleId);
  if (!aggregateQuery.data) return null;
  const workingCounts: Record<string, number> = {};
  for (const id of activeIds) workingCounts[id] = 0;
  for (const day of aggregateQuery.data.days) {
    if (day.kind !== 'WORKING') continue;
    if (workingCounts[day.applicantCategoryId] === undefined) continue;
    workingCounts[day.applicantCategoryId] =
      (workingCounts[day.applicantCategoryId] ?? 0) + 1;
  }
  const incomplete = activeIds.filter((id) => (workingCounts[id] ?? 0) === 0);
  if (incomplete.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
      <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>
        {incomplete.length} فئة بدون أيام عمل. أكمل التقويم لكل فئة قبل المتابعة.
      </span>
    </div>
  );
}

function CategoryTab({
  category,
  cycleId,
}: {
  category: ActiveCategoryView;
  cycleId: string;
}): JSX.Element {
  const daysQuery = useExamScheduleDays(cycleId, category.id);
  const days = daysQuery.data ?? [];
  const working = days.filter((d) => d.kind === 'WORKING').length;
  const incomplete = working === 0;

  return (
    <Tabs.Tab value={category.id}>
      <span className="inline-flex items-center gap-1.5">
        {category.nameAr}
        {incomplete ? (
          <AlertTriangle
            size={12}
            strokeWidth={1.75}
            className="text-gold-700"
            aria-label="تقويم غير مكتمل"
          />
        ) : null}
      </span>
    </Tabs.Tab>
  );
}

function CategoryPanel({
  cycle,
  category,
  candidateSources,
  canWrite,
}: {
  cycle: AdmissionCycle;
  category: ActiveCategoryView;
  candidateSources: ActiveCategoryView[];
  canWrite: boolean;
}): JSX.Element {
  const daysQuery = useExamScheduleDays(cycle.id, category.id);
  const days = daysQuery.data ?? [];
  const summary = useMemo(() => {
    const working = days.filter((d) => d.kind === 'WORKING').length;
    const off = days.filter((d) => d.kind === 'OFF').length;
    return { working, off, total: days.length };
  }, [days]);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [dayFormOpen, setDayFormOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<ExamScheduleDay | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const cycleStartIso = toIsoDate(cycle.openDate);
  const cycleEndIso = toIsoDate(cycle.closeDate);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-1">
          <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-600">
            <Badge tone="success">{summary.working} يوم عمل</Badge>
            <Badge tone="warning">{summary.off} عطلة</Badge>
            <Badge tone="neutral">{summary.total} إجمالي</Badge>
          </div>
          {canWrite ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                leadingIcon={<CalendarPlus size={14} strokeWidth={1.75} />}
                onClick={() => setBulkOpen(true)}
              >
                توليد أيام جماعي
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<Plus size={14} strokeWidth={1.75} />}
                onClick={() => {
                  setEditingDay(null);
                  setDayFormOpen(true);
                }}
              >
                إضافة يوم
              </Button>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" aria-label="إجراءات إضافية">
                    <MoreVertical size={14} strokeWidth={1.75} />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item
                    onSelect={() => setCopyOpen(true)}
                    disabled={candidateSources.length === 0}
                  >
                    <Copy size={12} strokeWidth={1.75} className="me-2 inline-block" />
                    نسخ من فئة أخرى
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </Card>

      <DaysTable
        cycleId={cycle.id}
        applicantCategoryId={category.id}
        days={days}
        isLoading={daysQuery.isLoading}
        isError={daysQuery.isError}
        onEdit={(d) => {
          setEditingDay(d);
          setDayFormOpen(true);
        }}
      />

      <BulkGenerateDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        cycleId={cycle.id}
        applicantCategoryId={category.id}
        categoryNameAr={category.nameAr}
        cycleStartIso={cycleStartIso}
        cycleEndIso={cycleEndIso}
        existingDays={days}
      />

      <DayFormDialog
        open={dayFormOpen}
        onClose={() => {
          setDayFormOpen(false);
          setEditingDay(null);
        }}
        cycleId={cycle.id}
        applicantCategoryId={category.id}
        categoryNameAr={category.nameAr}
        cycleStartIso={cycleStartIso}
        cycleEndIso={cycleEndIso}
        day={editingDay}
      />

      <CopyScheduleDialog
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        cycleId={cycle.id}
        targetCategoryId={category.id}
        targetCategoryNameAr={category.nameAr}
        candidateSources={candidateSources}
      />
    </div>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب اختيار دورة قبول"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
