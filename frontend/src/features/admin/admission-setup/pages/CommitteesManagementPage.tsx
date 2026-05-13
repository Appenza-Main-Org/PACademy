/**
 * إدارة اللجان — wizard step.
 *
 * Sub-tabbed step. Two panels under a shared per-category strip:
 *   • `roster`   — تكوين اللجان (which committees the category uses)
 *   • `bindings` — ربط اللجان بالمواعيد (per-(committee × day) capacity
 *                  + grade range matrix)
 * Active sub-tab is mirrored in `?subtab=roster|bindings` so deep links
 * are stable. A warning dot on each tab trigger surfaces incompleteness
 * — see `lib/step-status.ts` for the rules.
 *
 * Active-category source is `useCategoryConfigs()` filtered by
 * `isActive === true`, surfaced via the shared `useActiveCategoriesForCycle`
 * helper. Persistence in the roster panel flows through
 * `useSetCommitteeBindings(...)` exactly as before; the bindings panel
 * owns its own per-cell `CommitteeDayBinding` rows via
 * `committeeBindingService`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Plus, Save, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  MultiSelect,
  PageHeader,
  Tabs,
  toast,
} from '@/shared/components';
import type { ComboboxOption } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useCommittees } from '@/features/committees';
import { useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { num } from '@/shared/lib/format';
import { MOCK } from '@/shared/mock-data';
import {
  APPLICANT_CATEGORY_KEYS,
  type AdmissionCycle,
  type ApplicantCategoryKey,
  type Committee,
} from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { useActiveCategoriesForCycle } from '../lib/activeCategories';
import {
  useCommitteeBindings,
  useSetCommitteeBindings,
} from '../api/admission-setup.queries';
import { useCycleCommitteeBindings } from '../api/committeeBinding.queries';
import { CommitteeBindingsPanel } from '../components/committeeBinding/CommitteeBindingsPanel';

/** Cycles only declare `year`; the academic year string is `${year}-${year+1}`. */
function academicYearForCycle(cycle: AdmissionCycle): string {
  return `${cycle.year}-${cycle.year + 1}`;
}

function isApplicantCategoryKey(code: string): code is ApplicantCategoryKey {
  return (APPLICANT_CATEGORY_KEYS as readonly string[]).includes(code);
}

export function CommitteesManagementPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} />}
    </AdmissionSetupShell>
  );
}

interface BodyProps {
  cycle: AdmissionCycle;
}

const SUBTAB_VALUES = ['roster', 'bindings'] as const;
type SubTab = (typeof SUBTAB_VALUES)[number];

function isSubTab(v: string | null): v is SubTab {
  return v === 'roster' || v === 'bindings';
}

function Body({ cycle }: BodyProps): JSX.Element {
  const activeQuery = useActiveCategoriesForCycle(cycle.id);
  const active = useMemo(
    () =>
      (activeQuery.data ?? [])
        .filter((c) => isApplicantCategoryKey(c.code))
        .map((c) => ({
          key: c.code as ApplicantCategoryKey,
          labelAr: c.nameAr,
        })),
    [activeQuery.data],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSubtab = searchParams.get('subtab');
  const subtab: SubTab = isSubTab(requestedSubtab) ? requestedSubtab : 'roster';

  const cycleBindingsQuery = useCycleCommitteeBindings(cycle.id);

  if (activeQuery.isLoading) {
    return <LoadingState variant="card-grid" />;
  }

  if (active.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="إدارة اللجان"
          subtitle="اختر اللجان التي ستستقبل المتقدمين في هذه الدورة."
        />
        <EmptyState
          variant="generic"
          title="يرجى تفعيل فئة واحدة على الأقل من إعدادات التقديم"
          action={
            <Link to={ROUTES.admin.admissionSetup.applicationSettings} className="inline-flex">
              <Button variant="primary">إعدادات التقديم</Button>
            </Link>
          }
        />
      </div>
    );
  }

  /* ── Sub-tab warning dots ─────────────────────────────────────────── */
  const activeKeys = active.map((a) => a.key as string);
  const rosterByCategory: Record<string, number> = {};
  for (const k of activeKeys) {
    const count = MOCK.categoryCommittees.filter(
      (r) => r.cycleId === cycle.id && r.categoryId === k,
    ).length;
    rosterByCategory[k] = count;
  }
  const rosterIncomplete = activeKeys.some((k) => (rosterByCategory[k] ?? 0) === 0);

  const bindingsByCategory: Record<string, number> = {};
  for (const k of activeKeys) bindingsByCategory[k] = 0;
  for (const b of cycleBindingsQuery.data ?? []) {
    if (!b.isActive) continue;
    if (bindingsByCategory[b.applicantCategoryId] === undefined) continue;
    bindingsByCategory[b.applicantCategoryId] =
      (bindingsByCategory[b.applicantCategoryId] ?? 0) + 1;
  }
  const bindingsIncomplete = activeKeys.some(
    (k) => (bindingsByCategory[k] ?? 0) === 0,
  );

  const handleSubTabChange = (next: string): void => {
    if (!isSubTab(next)) return;
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set('subtab', next);
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="إدارة اللجان"
        subtitle={`العام الأكاديمي ${academicYearForCycle(cycle)} · اللجان مفلترة لكل فئة على حدة.`}
        actions={
          <Link to={ROUTES.committee.list} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={
                <ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />
              }
            >
              إدارة اللجان الكاملة
            </Button>
          </Link>
        }
      />
      <Card>
        <Tabs value={subtab} onValueChange={handleSubTabChange}>
          <Tabs.List aria-label="أقسام إدارة اللجان">
            <Tabs.Tab value="roster">
              <span className="inline-flex items-center gap-1.5">
                <span>تكوين اللجان</span>
                {rosterIncomplete && <WarningDot label="هناك فئة بدون لجان معيّنة" />}
              </span>
            </Tabs.Tab>
            <Tabs.Tab value="bindings">
              <span className="inline-flex items-center gap-1.5">
                <span>ربط اللجان بالمواعيد</span>
                {bindingsIncomplete && (
                  <WarningDot label="هناك فئة بدون روابط مفعّلة" />
                )}
              </span>
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="roster">
            <div className="pt-3">
              <RosterSubTab cycle={cycle} active={active} />
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="bindings">
            <div className="pt-3">
              <CommitteeBindingsPanel cycle={cycle} active={active} />
            </div>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  );
}

interface ActiveCategory {
  key: ApplicantCategoryKey;
  labelAr: string;
}

interface RosterSubTabProps {
  cycle: AdmissionCycle;
  active: ActiveCategory[];
}

function RosterSubTab({ cycle, active }: RosterSubTabProps): JSX.Element {
  const [activeKey, setActiveKey] = useState<ApplicantCategoryKey | null>(null);
  const resolvedActive: ApplicantCategoryKey | null =
    activeKey && active.some((c) => c.key === activeKey)
      ? activeKey
      : (active[0]?.key ?? null);
  return (
    <Tabs
      value={resolvedActive ?? active[0]!.key}
      onValueChange={(next) => setActiveKey(next as ApplicantCategoryKey)}
    >
      <Tabs.List aria-label="فئات التقديم النشطة">
        {active.map((cat) => (
          <Tabs.Tab key={cat.key} value={cat.key}>
            {cat.labelAr}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {active.map((cat) => (
        <Tabs.Panel key={cat.key} value={cat.key}>
          <div className="pt-3">
            <CategoryBindings cycle={cycle} categoryKey={cat.key} categoryLabel={cat.labelAr} />
          </div>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

function WarningDot({ label }: { label: string }): JSX.Element {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: 'var(--terra-500)' }}
    />
  );
}

interface CategoryBindingsProps {
  cycle: AdmissionCycle;
  categoryKey: ApplicantCategoryKey;
  categoryLabel: string;
}

function CategoryBindings({
  cycle,
  categoryKey,
  categoryLabel,
}: CategoryBindingsProps): JSX.Element {
  const academicYearId = academicYearForCycle(cycle);
  const canWrite = useAdmissionSetupCanWrite();
  const actorUserId = useAuthStore((s) => s.user?.id);

  const committeesQuery = useCommittees();
  const bindingsQuery = useCommitteeBindings(cycle.id, categoryKey);
  const setBindings = useSetCommitteeBindings();

  const allCommittees = committeesQuery.data ?? [];

  const eligibleCommittees = useMemo<Committee[]>(() => {
    return allCommittees.filter((c) => {
      if (c.deletedAt) return false;
      if (c.status === 'inactive') return false;
      if (c.academicYearId && c.academicYearId !== academicYearId) return false;
      return true;
    });
  }, [allCommittees, academicYearId]);

  const eligibleIds = useMemo(
    () => new Set(eligibleCommittees.map((c) => c.id)),
    [eligibleCommittees],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    if (!bindingsQuery.data) return;
    const ids = Array.from(new Set(bindingsQuery.data.map((b) => b.committeeId)));
    setSelectedIds(ids);
  }, [bindingsQuery.data]);

  const comboboxOptions = useMemo<ComboboxOption[]>(
    () => eligibleCommittees.map((c) => toComboboxOption(c)),
    [eligibleCommittees],
  );

  if (committeesQuery.isLoading || bindingsQuery.isLoading) {
    return <LoadingState variant="card-grid" />;
  }
  if (committeesQuery.isError) {
    return <ErrorState title="تعذّر تحميل اللجان" onRetry={() => committeesQuery.refetch()} />;
  }

  const hasSelections = selectedIds.length > 0;

  const handleSelect = (next: string[]): void => {
    const sanitized = next.filter((id) => eligibleIds.has(id));
    const deduped = Array.from(new Set(sanitized));
    if (deduped.length !== next.length) {
      toast('تمت تصفية لجنة غير متاحة من الاختيار', 'warning');
    }
    setSelectedIds(deduped);
  };

  const toggleCard = (committee: Committee): void => {
    if (!canWrite) return;
    if (!isCommitteeSelectable(committee, eligibleIds)) return;
    setSelectedIds((prev) =>
      prev.includes(committee.id)
        ? prev.filter((id) => id !== committee.id)
        : [...prev, committee.id],
    );
  };

  const handleSave = async (): Promise<void> => {
    if (!canWrite) return;
    try {
      await setBindings.mutateAsync({
        cycleId: cycle.id,
        academicYearId,
        categoryId: categoryKey,
        committeeIds: selectedIds,
        ...(actorUserId ? { actorUserId } : {}),
      });
      toast(`تم حفظ اللجان المختارة لفئة "${categoryLabel}"`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذّر حفظ الاختيار';
      toast(message, 'danger');
    }
  };

  if (allCommittees.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد لجان لهذه الفئة بعد"
        action={
          <Link to={ROUTES.committee.create} className="inline-flex">
            <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
              إضافة لجنة
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SelectionPanel
        options={comboboxOptions}
        value={selectedIds}
        onChange={handleSelect}
        disabled={!canWrite}
        onSave={handleSave}
        isSaving={setBindings.isPending}
        eligibleCount={eligibleCommittees.length}
      />

      {!hasSelections && eligibleCommittees.length === 0 ? (
        <EmptyState
          variant="generic"
          title="لا توجد لجان لهذه الفئة بعد"
          action={
            <Link to={ROUTES.committee.create} className="inline-flex">
              <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
                إضافة لجنة
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {eligibleCommittees.map((c) => (
            <CommitteeCard
              key={c.id}
              committee={c}
              selected={selectedIds.includes(c.id)}
              disabled={!canWrite || !isCommitteeSelectable(c, eligibleIds)}
              onToggle={() => toggleCard(c)}
            />
          ))}
          {eligibleCommittees.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <EmptyState
                variant="generic"
                title="لا توجد لجان لهذه الفئة بعد"
                action={
                  <Link to={ROUTES.committee.create} className="inline-flex">
                    <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
                      إضافة لجنة
                    </Button>
                  </Link>
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Selection panel (MultiSelect + save action) ───────────────────── */

interface SelectionPanelProps {
  options: ComboboxOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  onSave: () => void;
  isSaving: boolean;
  eligibleCount: number;
}

function SelectionPanel({
  options,
  value,
  onChange,
  disabled,
  onSave,
  isSaving,
  eligibleCount,
}: SelectionPanelProps): JSX.Element {
  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex flex-col gap-1">
        <h3 className="font-ar-display text-md font-bold text-ink-900">
          اللجان المتاحة للتوزيع
        </h3>
        <p className="text-2xs text-ink-500">
          اختر اللجان التي ستستقبل المتقدمين في هذه الفئة. اللجان المعطلة أو المكتملة لا تظهر هنا.
          <span className="ms-1 font-numeric tnum">{num(eligibleCount)} لجنة متاحة</span>.
        </p>
      </div>

      <MultiSelect
        label="اللجان المختارة"
        placeholder="ابحث وأضف لجنة…"
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        ariaLabel="اللجان المتاحة للتوزيع"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-2xs text-ink-500">
          {value.length === 0
            ? 'لم يتم اختيار أي لجنة بعد'
            : `${num(value.length)} لجنة مختارة`}
        </p>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Save size={14} strokeWidth={1.75} />}
          onClick={onSave}
          disabled={disabled || isSaving}
          isLoading={isSaving}
        >
          حفظ الاختيار
        </Button>
      </div>
    </Card>
  );
}

/* ── Committee card with selectable state ────────────────────────────── */

interface CommitteeCardProps {
  committee: Committee;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function CommitteeCard({
  committee,
  selected,
  disabled,
  onToggle,
}: CommitteeCardProps): JSX.Element {
  const state = deriveCardState(committee);
  const remaining = remainingSeats(committee);
  const specializations = resolveSpecializations(committee.specializationIds ?? []);
  const officersCount = committee.officerIds?.length ?? committee.members;
  const assignedCount = committee.applicants;

  const interactive = !disabled;
  return (
    <div
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-pressed={selected}
      aria-disabled={!interactive}
      onClick={interactive ? onToggle : undefined}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        'block rounded-lg focus-visible:shadow-focus-teal focus-visible:outline-none',
        interactive ? 'cursor-pointer' : 'cursor-not-allowed',
      )}
    >
      <Card
        variant="elevated"
        className={cn(
          'h-full transition-shadow duration-fast ease-standard',
          interactive && 'hover:shadow-md',
          selected && 'shadow-md',
          !interactive && 'opacity-60',
        )}
        style={selected ? { borderInlineStartWidth: 4, borderInlineStartColor: 'var(--accent-500)' } : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-ar-display text-md font-bold text-ink-900">
              {committee.name}
            </h3>
            <p className="mt-1 text-2xs text-ink-500">رئيس اللجنة: {committee.head}</p>
          </div>
          {selected ? (
            <Badge tone="accent" icon={<CheckCircle2 size={12} strokeWidth={1.75} />}>
              مختارة
            </Badge>
          ) : (
            <StateBadge state={state} />
          )}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-2xs">
          <Stat label="الضباط المعيّنون" value={`${num(officersCount)}`} />
          <Stat label="الطاقة الاستيعابية" value={committee.capacity ? num(committee.capacity) : '—'} />
          <Stat label="المتقدمون المخصصون" value={num(assignedCount)} />
          <Stat
            label="الأماكن المتبقية"
            value={remaining === null ? '—' : num(remaining)}
            tone={remaining !== null && remaining <= 0 ? 'danger' : 'default'}
          />
        </dl>

        {specializations.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Users size={12} strokeWidth={1.75} className="text-ink-400" aria-hidden />
            {specializations.map((s) => (
              <Badge key={s.id} tone="neutral">
                {s.nameAr}
              </Badge>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

type CommitteeCardState = 'active' | 'full' | 'inactive';

function deriveCardState(c: Committee): CommitteeCardState {
  if (c.status === 'inactive') return 'inactive';
  if (c.capacity !== undefined && c.applicants >= c.capacity) return 'full';
  return 'active';
}

function remainingSeats(c: Committee): number | null {
  if (c.capacity === undefined) return null;
  return Math.max(0, c.capacity - c.applicants);
}

function isCommitteeSelectable(c: Committee, eligibleIds: Set<string>): boolean {
  return eligibleIds.has(c.id) && deriveCardState(c) === 'active';
}

function resolveSpecializations(ids: string[]): { id: string; nameAr: string }[] {
  const dict = MOCK.lookups.specializations.filter((s) => s.isActive);
  const out: { id: string; nameAr: string }[] = [];
  for (const id of ids) {
    const match = dict.find((s) => s.code === id);
    if (match) out.push({ id: match.code, nameAr: match.name });
  }
  return out;
}

function toComboboxOption(c: Committee): ComboboxOption {
  const state = deriveCardState(c);
  const remaining = remainingSeats(c);
  const badge =
    state === 'inactive'
      ? 'معطلة'
      : state === 'full'
        ? 'مكتملة'
        : remaining !== null
          ? `${num(remaining)} مقعد متاح`
          : 'متاحة';
  return {
    value: c.id,
    label: `${c.name} — ${c.head}`,
    badge,
    disabled: state !== 'active',
    keywords: [c.head, ...(c.specializationIds ?? [])].join(' '),
  };
}

interface StatProps {
  label: string;
  value: string;
  tone?: 'default' | 'danger';
}

function Stat({ label, value, tone = 'default' }: StatProps): JSX.Element {
  return (
    <div className="flex flex-col">
      <dt className="text-ink-500">{label}</dt>
      <dd className={cn('font-medium', tone === 'danger' ? 'text-terra-700' : 'text-ink-900')}>
        {value}
      </dd>
    </div>
  );
}

function StateBadge({ state }: { state: CommitteeCardState }): JSX.Element {
  if (state === 'full') return <Badge tone="danger">مكتملة</Badge>;
  if (state === 'inactive') return <Badge tone="neutral">معطلة</Badge>;
  return <Badge tone="success" dot>نشطة</Badge>;
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب إنشاء دورة قبول أولاً"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
