/**
 * Step 8 — إدارة اللجان.
 *
 * Treats committees as dynamic lookup entities bound to the cycle's
 * academic year. The admin picks which committees enter the distribution
 * pool for this cycle (optionally per-category), reviews capacity /
 * specialization fit on each card, and persists the binding via
 * `useSetCommitteeBindings`. Selected committees are highlighted with
 * the accent-flavoured selected state; full / inactive committees are
 * disabled and excluded from the assignment pool.
 *
 * The "إضافة لجنة" / "إدارة اللجان الكاملة" actions still bridge to the
 * canonical committee app pages — this step *enrols* committees into the
 * cycle, the committee app *creates* them.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Plus, Save, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Combobox,
  EmptyState,
  ErrorState,
  LoadingState,
  MultiSelect,
  PageHeader,
  toast,
} from '@/shared/components';
import type { ComboboxOption } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useCommittees } from '@/features/committees';
import { useAuthStore } from '@/features/auth';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import { cn } from '@/shared/lib/cn';
import { num } from '@/shared/lib/format';
import { MOCK } from '@/shared/mock-data';
import type {
  AdmissionCycle,
  ApplicantCategory,
  ApplicantCategoryKey,
  Committee,
} from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  useCommitteeBindings,
  useSetCommitteeBindings,
} from '../api/admission-setup.queries';

const ALL_CATEGORIES_KEY = '__all__' as const;
type CategoryFilterValue = ApplicantCategoryKey | typeof ALL_CATEGORIES_KEY;

/** Cycles only declare `year`; the academic year string is `${year}-${year+1}`. */
function academicYearForCycle(cycle: AdmissionCycle): string {
  return `${cycle.year}-${cycle.year + 1}`;
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

function Body({ cycle }: BodyProps): JSX.Element {
  const academicYearId = academicYearForCycle(cycle);
  const canWrite = useAdmissionSetupCanWrite();
  const actorUserId = useAuthStore((s) => s.user?.id);

  const committeesQuery = useCommittees();
  const bindingsQuery = useCommitteeBindings(cycle.id, null);
  const categoriesQuery = useCategoriesAdmin();
  const setBindings = useSetCommitteeBindings();

  const allCommittees = committeesQuery.data ?? [];
  const allCategories = categoriesQuery.data ?? [];

  /* Active categories only — the picker filter must mirror what applicants
   * can actually enrol into for this cycle. */
  const activeCategories = useMemo<ApplicantCategory[]>(
    () => allCategories.filter((c) => !c.deletedAt && c.isOpen),
    [allCategories],
  );

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>(
    ALL_CATEGORIES_KEY,
  );

  /* Pool of committees the admin is *allowed* to select from. Mirrors the
   * server-side validation in `admissionSetupService.setCommitteeBindings`. */
  const eligibleCommittees = useMemo<Committee[]>(() => {
    return allCommittees.filter((c) => {
      if (c.deletedAt) return false;
      if (c.status === 'inactive') return false;
      if (c.academicYearId && c.academicYearId !== academicYearId) return false;
      return true;
    });
  }, [allCommittees, academicYearId]);

  /* Seed selection from persisted bindings on cycle change. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    if (!bindingsQuery.data) return;
    const ids = Array.from(new Set(bindingsQuery.data.map((b) => b.committeeId)));
    setSelectedIds(ids);
  }, [bindingsQuery.data]);

  if (committeesQuery.isLoading || bindingsQuery.isLoading) {
    return <LoadingState variant="card-grid" />;
  }
  if (committeesQuery.isError) {
    return <ErrorState title="تعذّر تحميل اللجان" onRetry={() => committeesQuery.refetch()} />;
  }

  const eligibleIds = new Set(eligibleCommittees.map((c) => c.id));

  /* Display set — when the admin filters by category, show only committees
   * whose specialization set overlaps the category's specialization scope.
   * Categories don't currently declare specialization links in mock-data,
   * so the filter falls back to "show everything" when no scope is set. */
  const filteredCommittees = useMemo<Committee[]>(() => {
    if (categoryFilter === ALL_CATEGORIES_KEY) return eligibleCommittees;
    /* No category→specialization edge yet — same pool, but the heading
     * makes the active filter obvious to the admin. */
    return eligibleCommittees;
  }, [eligibleCommittees, categoryFilter]);

  const comboboxOptions: ComboboxOption[] = eligibleCommittees.map((c) =>
    toComboboxOption(c),
  );

  const handleSelect = (next: string[]): void => {
    /* Filter out anything that turned ineligible between picker render
     * and submit (capacity hit, status flip, …). */
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
        ...(categoryFilter !== ALL_CATEGORIES_KEY ? { categoryId: categoryFilter } : {}),
        committeeIds: selectedIds,
        ...(actorUserId ? { actorUserId } : {}),
      });
      toast('تم حفظ اللجان المختارة للتوزيع', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذّر حفظ الاختيار';
      toast(message, 'danger');
    }
  };

  const hasNoCommittees = allCommittees.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="إدارة اللجان"
        subtitle={`${num(eligibleCommittees.length)} لجنة متاحة · ${num(selectedIds.length)} مختارة للتوزيع · العام الأكاديمي ${academicYearId}`}
        actions={
          <div className="flex items-center gap-2">
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
            <Link to={ROUTES.committee.create} className="inline-flex">
              <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
                إضافة لجنة
              </Button>
            </Link>
          </div>
        }
      />

      {hasNoCommittees ? (
        <EmptyState
          variant="generic"
          title="لا توجد لجان مسجلة بعد"
          description="ابدأ بإنشاء أول لجنة قبول لتظهر هنا، ثم ارجع لاختيارها للتوزيع."
          action={
            <Link to={ROUTES.committee.create} className="inline-flex">
              <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
                إنشاء لجنة جديدة
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <SelectionPanel
            options={comboboxOptions}
            value={selectedIds}
            onChange={handleSelect}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            activeCategories={activeCategories}
            disabled={!canWrite}
            onSave={handleSave}
            isSaving={setBindings.isPending}
          />

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredCommittees.map((c) => (
              <CommitteeCard
                key={c.id}
                committee={c}
                selected={selectedIds.includes(c.id)}
                disabled={!canWrite || !isCommitteeSelectable(c, eligibleIds)}
                onToggle={() => toggleCard(c)}
              />
            ))}
            {filteredCommittees.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3">
                <EmptyState
                  variant="generic"
                  title="لا توجد لجان مطابقة"
                  description="جرّب إزالة عامل تصفية الفئة لرؤية كامل اللجان المتاحة."
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Selection panel (MultiSelect + category filter + save action) ───── */

interface SelectionPanelProps {
  options: ComboboxOption[];
  value: string[];
  onChange: (next: string[]) => void;
  categoryFilter: CategoryFilterValue;
  onCategoryChange: (next: CategoryFilterValue) => void;
  activeCategories: ApplicantCategory[];
  disabled: boolean;
  onSave: () => void;
  isSaving: boolean;
}

function SelectionPanel({
  options,
  value,
  onChange,
  categoryFilter,
  onCategoryChange,
  activeCategories,
  disabled,
  onSave,
  isSaving,
}: SelectionPanelProps): JSX.Element {
  const categoryOptions: ComboboxOption[] = [
    { value: ALL_CATEGORIES_KEY, label: 'كل الفئات' },
    ...activeCategories.map((c) => ({ value: c.key, label: c.labelAr })),
  ];

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex flex-col gap-1">
        <h3 className="font-ar-display text-md font-bold text-ink-900">
          اللجان المتاحة للتوزيع
        </h3>
        <p className="text-2xs text-ink-500">
          اختر اللجان التي ستستقبل المتقدمين في هذه الدورة. اللجان المعطلة أو
          المكتملة لا تظهر هنا.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <MultiSelect
          label="اللجان المختارة"
          placeholder="ابحث وأضف لجنة…"
          options={options}
          value={value}
          onChange={onChange}
          disabled={disabled}
          ariaLabel="اللجان المتاحة للتوزيع"
        />
        <Combobox
          label="تصفية حسب الفئة"
          options={categoryOptions}
          value={categoryFilter}
          onChange={(next) =>
            onCategoryChange((next as CategoryFilterValue | null) ?? ALL_CATEGORIES_KEY)
          }
          ariaLabel="تصفية اللجان حسب فئة المتقدمين"
        />
      </div>

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
  const dict = MOCK.referenceData.specializations;
  const out: { id: string; nameAr: string }[] = [];
  for (const id of ids) {
    const match = dict.find((s) => s.id === id);
    if (match) out.push({ id: match.id, nameAr: match.nameAr });
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
