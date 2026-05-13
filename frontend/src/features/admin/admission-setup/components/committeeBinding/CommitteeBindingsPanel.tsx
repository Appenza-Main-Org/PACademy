/**
 * Bindings sub-tab — top-level wiring.
 *
 * Renders a per-active-category Radix tab strip (so admins can never
 * accidentally write a binding across categories), a summary toolbar
 * with bulk/copy actions, and the (committee × WORKING-day) matrix.
 * Dialogs for create/edit, bulk eligibility, and copy row/column are
 * all owned here so the matrix stays presentational.
 */

import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Layers,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  EmptyState,
  ErrorState,
  LoadingState,
  Tabs,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useCommittees } from '@/features/committees';
import { MOCK } from '@/shared/mock-data';
import { num } from '@/shared/lib/format';
import type {
  AdmissionCycle,
  ApplicantCategoryKey,
  Committee,
} from '@/shared/types/domain';
import { useAdmissionSetupCanWrite } from '../AdmissionSetupShell';
import { useExamScheduleDays } from '../../api/examSchedule.queries';
import {
  useCommitteeDayBindings,
  useCycleCommitteeBindings,
} from '../../api/committeeBinding.queries';
import type {
  CommitteeDayBinding,
  ExamScheduleDay,
} from '../../types';
import { resolveCategoryGradingMode } from '../../lib/resolveGradingMode';
import { BindingFormDialog } from './BindingFormDialog';
import { BulkEligibilityDialog } from './BulkEligibilityDialog';
import { CopyColumnDialog, CopyRowDialog } from './CopyAxisDialogs';
import { CommitteeBindingMatrix } from './CommitteeBindingMatrix';

export interface CommitteeBindingsPanelProps {
  cycle: AdmissionCycle;
  active: Array<{ key: ApplicantCategoryKey; labelAr: string }>;
}

export function CommitteeBindingsPanel({
  cycle,
  active,
}: CommitteeBindingsPanelProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategoryId = searchParams.get('categoryId');

  const activeKeys = active.map((a) => a.key as string);
  const resolvedCategoryId: string | null =
    requestedCategoryId && activeKeys.includes(requestedCategoryId)
      ? requestedCategoryId
      : (active[0]?.key as string | undefined) ?? null;

  if (active.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد فئات مفعّلة في هذه الدورة"
        description="ارجع إلى الخطوة الأولى لتفعيل فئة واحدة على الأقل."
        action={
          <Link to={ROUTES.admin.admissionSetup.wizard('application_settings')}>
            <Button variant="primary">العودة إلى إعدادات التقديم</Button>
          </Link>
        }
      />
    );
  }

  const handleCategoryChange = (next: string): void => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set('categoryId', next);
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <CompletionBanner cycleId={cycle.id} active={active} />
      <Tabs
        value={resolvedCategoryId ?? activeKeys[0]!}
        onValueChange={handleCategoryChange}
      >
      <Tabs.List aria-label="فئات التقديم النشطة للربط">
        {active.map((cat) => (
          <Tabs.Tab key={cat.key} value={cat.key}>
            {cat.labelAr}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {active.map((cat) => (
        <Tabs.Panel key={cat.key} value={cat.key}>
          <div className="pt-3">
            <CategoryBindingsView
              cycle={cycle}
              categoryKey={cat.key}
              categoryLabel={cat.labelAr}
            />
          </div>
        </Tabs.Panel>
      ))}
      </Tabs>
    </div>
  );
}

/* ── Completion banner ─────────────────────────────────────────────── */

function CompletionBanner({
  cycleId,
  active,
}: {
  cycleId: string;
  active: Array<{ key: ApplicantCategoryKey; labelAr: string }>;
}): JSX.Element | null {
  const cycleBindingsQuery = useCycleCommitteeBindings(cycleId);
  const bindings = cycleBindingsQuery.data ?? [];

  const missing = active.filter((cat) => {
    const hasActive = bindings.some(
      (b) =>
        b.cycleId === cycleId &&
        b.applicantCategoryId === cat.key &&
        b.isActive,
    );
    return !hasActive;
  });

  if (missing.length === 0) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-dashed bg-gold-50 px-3 py-2 text-2xs text-gold-700"
      style={{ borderColor: 'var(--gold-300)' }}
    >
      <AlertTriangle
        size={14}
        strokeWidth={1.75}
        className="mt-0.5 flex-shrink-0"
        aria-hidden
      />
      <div>
        <span className="font-numeric tnum">{missing.length}</span>{' '}
        فئة بدون روابط مفعّلة:{' '}
        <span className="font-medium">
          {missing.map((m) => m.labelAr).join('، ')}
        </span>
      </div>
    </div>
  );
}

/* ── Per-category view ─────────────────────────────────────────────── */

interface CategoryBindingsViewProps {
  cycle: AdmissionCycle;
  categoryKey: ApplicantCategoryKey;
  categoryLabel: string;
}

function CategoryBindingsView({
  cycle,
  categoryKey,
  categoryLabel,
}: CategoryBindingsViewProps): JSX.Element {
  const canWrite = useAdmissionSetupCanWrite();
  const committeesQuery = useCommittees();
  const scheduleQuery = useExamScheduleDays(cycle.id, categoryKey);
  const bindingsQuery = useCommitteeDayBindings(cycle.id, categoryKey);

  const allCommittees = committeesQuery.data ?? [];

  /* Roster = committees in cycle's CategoryCommittees for this category.
   * Source of truth that anchors COMMITTEE_WRONG_CATEGORY. */
  const rosterCommittees = useMemo<Committee[]>(() => {
    const rosterIds = new Set(
      MOCK.categoryCommittees
        .filter((r) => r.cycleId === cycle.id && r.categoryId === categoryKey)
        .map((r) => r.committeeId),
    );
    return allCommittees.filter((c) => rosterIds.has(c.id) && !c.deletedAt);
  }, [allCommittees, cycle.id, categoryKey]);

  const workingDays = useMemo<ExamScheduleDay[]>(
    () => (scheduleQuery.data ?? []).filter((d) => d.kind === 'WORKING'),
    [scheduleQuery.data],
  );

  const mode = useMemo(
    () =>
      resolveCategoryGradingMode(categoryKey, {
        categoryLookup: MOCK.lookups['applicant-categories'],
        submissionTypeLookup: MOCK.lookups['submission-types'],
      }) ?? 'GRADES',
    [categoryKey],
  );

  /* ── Dialog state ─────────────────────────────────────────────────── */
  const [formOpen, setFormOpen] = useState(false);
  const [formEditing, setFormEditing] = useState<CommitteeDayBinding | null>(null);
  const [formInitialCommitteeId, setFormInitialCommitteeId] = useState<string | null>(null);
  const [formInitialDayId, setFormInitialDayId] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [copyRowOpen, setCopyRowOpen] = useState(false);
  const [copyRowSourceId, setCopyRowSourceId] = useState<string | null>(null);
  const [copyColumnOpen, setCopyColumnOpen] = useState(false);
  const [copyColumnSourceId, setCopyColumnSourceId] = useState<string | null>(null);

  const openAdd = (committeeId: string, examScheduleDayId: string): void => {
    setFormEditing(null);
    setFormInitialCommitteeId(committeeId);
    setFormInitialDayId(examScheduleDayId);
    setFormOpen(true);
  };
  const openEdit = (binding: CommitteeDayBinding): void => {
    setFormEditing(binding);
    setFormInitialCommitteeId(binding.committeeId);
    setFormInitialDayId(binding.examScheduleDayId);
    setFormOpen(true);
  };
  const openCopyRow = (committeeId: string): void => {
    setCopyRowSourceId(committeeId);
    setCopyRowOpen(true);
  };
  const openCopyColumn = (dayId: string): void => {
    setCopyColumnSourceId(dayId);
    setCopyColumnOpen(true);
  };

  /* ── Loading / error / empty states ───────────────────────────────── */
  if (
    committeesQuery.isLoading ||
    scheduleQuery.isLoading ||
    bindingsQuery.isLoading
  ) {
    return <LoadingState variant="card-grid" />;
  }
  if (committeesQuery.isError) {
    return (
      <ErrorState
        title="تعذّر تحميل اللجان"
        onRetry={() => committeesQuery.refetch()}
      />
    );
  }
  if (scheduleQuery.isError) {
    return (
      <ErrorState
        title="تعذّر تحميل تقويم الأيام"
        onRetry={() => scheduleQuery.refetch()}
      />
    );
  }
  if (bindingsQuery.isError) {
    return (
      <ErrorState
        title="تعذّر تحميل الروابط"
        onRetry={() => bindingsQuery.refetch()}
      />
    );
  }

  const bindings = bindingsQuery.data ?? [];

  if (rosterCommittees.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لم يتم تعيين أي لجنة لهذه الفئة في تبويب تكوين اللجان"
        description="افتح تبويب تكوين اللجان وأضف لجنة واحدة على الأقل قبل ربطها بالأيام."
        action={
          <Button
            variant="primary"
            onClick={() => {
              const sp = new URLSearchParams(window.location.search);
              sp.set('subtab', 'roster');
              window.history.replaceState(null, '', `?${sp.toString()}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            الانتقال إلى تكوين اللجان
          </Button>
        }
      />
    );
  }

  if (workingDays.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد أيام عمل مسجلة لهذه الفئة في تبويب مواعيد الاختبارات"
        description="افتح خطوة مواعيد الاختبارات وأضف يومًا عاملًا واحدًا على الأقل قبل ربط اللجان."
        action={
          <Link to={ROUTES.admin.admissionSetup.wizard('exam_dates')}>
            <Button variant="primary">الانتقال إلى مواعيد الاختبارات</Button>
          </Link>
        }
      />
    );
  }

  const activeBindings = bindings.filter((b) => b.isActive);
  const totalCapacity = activeBindings.reduce((acc, b) => acc + b.capacity, 0);

  return (
    <div className="flex flex-col gap-3">
      <Card variant="elevated" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-2xs">
            <Badge tone="neutral">
              <span className="font-numeric tnum">
                {num(rosterCommittees.length)}
              </span>{' '}
              لجنة
            </Badge>
            <Badge tone="neutral">
              <span className="font-numeric tnum">
                {num(workingDays.length)}
              </span>{' '}
              يوم
            </Badge>
            <Badge tone="accent">
              <span className="font-numeric tnum">
                {num(activeBindings.length)}
              </span>{' '}
              ربط مفعّل
            </Badge>
            <Badge tone="neutral">
              إجمالي السعة{' '}
              <span className="ms-1 font-numeric tnum">{num(totalCapacity)}</span>
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ChevronDown size={14} strokeWidth={1.75} />}
                  disabled={!canWrite}
                >
                  إجراءات سريعة
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item onSelect={() => setBulkOpen(true)}>
                  <Sparkles size={12} strokeWidth={1.75} className="me-2 inline-block" aria-hidden />
                  تطبيق أهلية موحدة…
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => setCopyRowOpen(true)}>
                  <Layers size={12} strokeWidth={1.75} className="me-2 inline-block" aria-hidden />
                  نسخ صف لجنة…
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => setCopyColumnOpen(true)}>
                  <Copy size={12} strokeWidth={1.75} className="me-2 inline-block" aria-hidden />
                  نسخ عمود يوم…
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus size={14} strokeWidth={1.75} />}
              disabled={!canWrite}
              onClick={() =>
                openAdd(rosterCommittees[0]!.id, workingDays[0]!.id)
              }
            >
              إضافة ربط
            </Button>
          </div>
        </div>

        <CommitteeBindingMatrix
          cycle={cycle}
          categoryKey={categoryKey}
          rosterCommittees={rosterCommittees}
          workingDays={workingDays}
          bindings={bindings}
          canWrite={canWrite}
          onAddCell={openAdd}
          onEditCell={openEdit}
          onCopyRow={openCopyRow}
          onCopyColumn={openCopyColumn}
        />
      </Card>

      <BindingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        cycle={cycle}
        categoryKey={categoryKey}
        categoryLabel={categoryLabel}
        mode={mode}
        initialCommitteeId={formInitialCommitteeId}
        initialExamScheduleDayId={formInitialDayId}
        editing={formEditing}
        rosterCommittees={rosterCommittees}
        workingDays={workingDays}
      />

      <BulkEligibilityDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        cycle={cycle}
        categoryKey={categoryKey}
        categoryLabel={categoryLabel}
        mode={mode}
        rosterCommittees={rosterCommittees}
        workingDays={workingDays}
      />

      <CopyRowDialog
        open={copyRowOpen}
        onOpenChange={setCopyRowOpen}
        cycle={cycle}
        categoryKey={categoryKey}
        categoryLabel={categoryLabel}
        initialSourceCommitteeId={copyRowSourceId}
        rosterCommittees={rosterCommittees}
      />

      <CopyColumnDialog
        open={copyColumnOpen}
        onOpenChange={setCopyColumnOpen}
        cycle={cycle}
        categoryKey={categoryKey}
        categoryLabel={categoryLabel}
        initialSourceDayId={copyColumnSourceId}
        workingDays={workingDays}
      />
    </div>
  );
}
