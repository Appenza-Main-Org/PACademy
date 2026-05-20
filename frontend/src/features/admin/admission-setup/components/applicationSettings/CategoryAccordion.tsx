/**
 * CategoryAccordion — category condition authoring workspace.
 *
 * Sources every applicant-category from the
 * `admin/lookups/applicant-categories` lookup (no hardcoded list). Each
 * row carries a `type` (`university` | `pre_university`) that decides
 * which editor section is rendered inside the focused editor pane:
 *
 *   • `university` (جامعي)     → <GeneralRulesSection /> — generalised
 *     faculty + specialization picker (1F/1S flat, 1F/NS accordion,
 *     >1F accordion-per-faculty).
 *   • `pre_university` (ثانوي) → <ThanawiRulesSection /> — exam-round +
 *     committee + graduation-year + school-category grid.
 *
 * The left rail keeps long category lists manageable: admins search,
 * pick one category, then author its committee conditions without
 * scrolling through every other category's fields.
 *
 * «معيار التمييز» rendering:
 *   • Every active category renders here regardless of its criterion
 *     state — admins still need to author the rest of the rules.
 *   • The criterion *label* on the row header only shows when the
 *     category carries a criterion (`excellenceCriterion !== null`).
 *     Otherwise the label is hidden and the rest of the header (name +
 *     stage badge + counts + completion badge) renders normally.
 */

import { useMemo, useState } from 'react';
import {
  Check,
  Circle,
  CircleDashed,
  Layers,
  ListChecks,
  Search,
} from 'lucide-react';
import { Badge, EmptyState, ErrorState, LoadingState } from '@/shared/components';
import type { BadgeTone } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { cn } from '@/shared/lib/cn';
import { num } from '@/shared/lib/format';
import { useCategoryConfigs } from '../../api/applicationSettings.queries';
import type { CategoryConfigJoined } from '../../api/applicationSettings.service';
import {
  deriveExcellenceMode,
  type ExcellenceMode,
} from '../../lib/excellenceMode';
import {
  selectCategoryCompletion,
  useAdmissionSetupWizardStore,
  type CategoryCompletionState,
} from '../../store/wizardSharedState';
import { GeneralRulesSection } from './GeneralRulesSection';
import { ThanawiRulesSection } from './ThanawiRulesSection';

export function CategoryAccordion(): JSX.Element {
  const configsQuery = useCategoryConfigs();
  const categoriesQuery = useLookup('applicant-categories');
  const excellenceQuery = useLookup('excellence-criteria');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const local = useAdmissionSetupWizardStore((s) => s.local);
  const approved = useAdmissionSetupWizardStore((s) => s.approved);

  const isLoading =
    configsQuery.isLoading ||
    categoriesQuery.isLoading ||
    excellenceQuery.isLoading;

  const isError =
    configsQuery.isError ||
    categoriesQuery.isError ||
    excellenceQuery.isError ||
    !configsQuery.data;

  /* Filter to active lookup rows then preserve the configs' sortOrder.
   * The join carries `categoryType`/`categoryFacultyCodes`/
   * `categorySpecializationCodes` straight off the lookup so feature
   * components don't have to read the lookup themselves. */
  const lookupActiveCodes = useMemo(
    () =>
      new Set(
        (categoriesQuery.data ?? []).filter((c) => c.isActive).map((c) => c.code),
      ),
    [categoriesQuery.data],
  );

  const activeConfigs = useMemo(
    () =>
      (configsQuery.data ?? []).filter((c) =>
        lookupActiveCodes.has(c.categoryCode),
      ),
    [configsQuery.data, lookupActiveCodes],
  );

  /* Every active category renders here. The criterion label on the
   * row header only appears when the category carries one — categories
   * without a criterion still need to be editable (admins set the rest
   * of the rules regardless), so the row stays visible. */
  const visibleConfigs = activeConfigs;

  const criterionLabelByCode = useMemo(
    () =>
      new Map(
        (excellenceQuery.data ?? []).map((row) => [row.code, row.name] as const),
      ),
    [excellenceQuery.data],
  );
  const excellenceRows = excellenceQuery.data ?? [];

  const decoratedConfigs = useMemo(
    () =>
      visibleConfigs.map((config) => {
        const completion = selectCategoryCompletion(
          config.categoryCode,
          config.categoryType,
          [...local, ...approved],
          config.categorySpecializationCodes,
        );
        const excellenceLabel =
          config.excellenceCriterion === null
            ? null
            : criterionLabelByCode.get(config.excellenceCriterion) ??
              config.excellenceCriterion;
        const excellenceMode = deriveExcellenceMode(
          config.excellenceCriterion,
          excellenceRows,
        );
        const conditionCount = [...local, ...approved].filter(
          (row) => row.categoryCode === config.categoryCode,
        ).length;
        return {
          config,
          completion,
          excellenceLabel,
          excellenceMode,
          conditionCount,
        };
      }),
    [
      visibleConfigs,
      local,
      approved,
      criterionLabelByCode,
      excellenceRows,
    ],
  );

  const filteredConfigs = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (needle === '') return decoratedConfigs;
    return decoratedConfigs.filter(({ config, excellenceLabel }) => {
      const haystack = [
        config.categoryNameAr,
        config.categoryCode,
        config.categoryType === 'university' ? 'جامعي' : 'ثانوي',
        excellenceLabel ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [decoratedConfigs, searchTerm]);

  const selected =
    decoratedConfigs.find(({ config }) => config.id === selectedId) ??
    filteredConfigs[0] ??
    decoratedConfigs[0] ??
    null;

  const totals = useMemo(
    () => ({
      complete: decoratedConfigs.filter((item) => item.completion === 'complete').length,
      partial: decoratedConfigs.filter((item) => item.completion === 'partial').length,
      empty: decoratedConfigs.filter((item) => item.completion === 'empty').length,
    }),
    [decoratedConfigs],
  );

  if (isLoading) {
    return <LoadingState variant="list" />;
  }
  if (isError) {
    return (
      <ErrorState
        title="تعذر تحميل الفئات"
        description="حاول إعادة المحاولة بعد قليل."
        onRetry={() => {
          configsQuery.refetch();
          categoriesQuery.refetch();
          excellenceQuery.refetch();
        }}
      />
    );
  }

  if (decoratedConfigs.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد فئات نشطة"
        description="فعّل فئة واحدة على الأقل من الأكواد المرجعية لبدء إضافة الشروط."
      />
    );
  }

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-card">
      <div className="border-b border-border-subtle bg-ink-50/40 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 font-ar text-base font-semibold text-ink-900">
              شروط التقديم حسب الفئة
            </h2>
            <p className="m-0 mt-1 font-ar text-xs text-ink-500">
              اختر فئة واحدة، أضف شروط اللجنة، ثم اعتمد الفئة قبل الانتقال للفئة التالية.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">مكتمل {num(totals.complete)}</Badge>
            <Badge tone="warning">جزئي {num(totals.partial)}</Badge>
            <Badge tone="neutral">فارغ {num(totals.empty)}</Badge>
          </div>
        </div>
      </div>

      <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-border-subtle bg-surface-subtle p-3 lg:border-b-0 lg:border-e">
          <label className="relative block">
            <span className="sr-only">بحث في الفئات</span>
            <Search
              size={15}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400 start-3"
              aria-hidden
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ابحث عن فئة…"
              className="h-10 w-full rounded-md border border-border-default bg-surface-card ps-9 pe-3 font-ar text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-teal-500 focus:shadow-focus-teal"
            />
          </label>

          <div className="mt-3 flex max-h-[620px] flex-col gap-2 overflow-y-auto pe-1">
            {filteredConfigs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-subtle bg-surface-card px-3 py-6 text-center font-ar text-xs text-ink-500">
                لا توجد فئات مطابقة للبحث.
              </div>
            ) : (
              filteredConfigs.map((item) => (
                <CategoryNavButton
                  key={item.config.id}
                  item={item}
                  selected={selected?.config.id === item.config.id}
                  onSelect={() => setSelectedId(item.config.id)}
                />
              ))
            )}
          </div>
        </aside>

        <main className="min-w-0 bg-ink-50/25 p-4">
          {selected && <ConfigItem {...selected} />}
        </main>
      </div>
    </section>
  );
}

interface DecoratedConfig {
  config: CategoryConfigJoined;
  excellenceLabel: string | null;
  excellenceMode: ExcellenceMode | null;
  completion: CategoryCompletionState;
  conditionCount: number;
}

function CategoryNavButton({
  item,
  selected,
  onSelect,
}: {
  item: DecoratedConfig;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const typeLabel = item.config.categoryType === 'university' ? 'جامعي' : 'ثانوي';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-md border p-3 text-start transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:shadow-focus-teal',
        selected
          ? 'border-teal-300 bg-teal-50 shadow-sm'
          : 'border-border-subtle bg-surface-card hover:border-teal-200 hover:bg-teal-50/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block truncate font-ar text-sm font-semibold text-ink-900">
            {item.config.categoryNameAr}
          </span>
          <span className="mt-1 inline-flex items-center gap-1 font-ar text-2xs text-ink-500">
            <Layers size={11} strokeWidth={1.75} aria-hidden />
            {typeLabel}
            {item.excellenceLabel ? ` · ${item.excellenceLabel}` : ''}
          </span>
        </div>
        <CompletionBadge state={item.completion} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 font-ar text-2xs text-ink-500">
        <span>
          {item.config.singleAxis
            ? `${item.config.yearCount} سنة`
            : `${item.config.specializationCount} تخصص`}
        </span>
        <span>{num(item.conditionCount)} شرط</span>
      </div>
    </button>
  );
}

interface ConfigItemProps {
  config: CategoryConfigJoined;
  excellenceLabel: string | null;
  /** Resolved «معيار التمييز» discriminator — TAGDIR (تقدير) hides the
   *  score pair, GRADES (درجة) hides the grade pair. `null` (no
   *  criterion picked) keeps both pairs visible. */
  excellenceMode: ExcellenceMode | null;
  completion: CategoryCompletionState;
  conditionCount: number;
}

function ConfigItem({
  config,
  excellenceLabel,
  excellenceMode,
  completion,
  conditionCount,
}: ConfigItemProps): JSX.Element {
  const typeLabel = config.categoryType === 'university' ? 'جامعي' : 'ثانوي';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="rounded-lg border border-border-subtle bg-surface-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 font-ar text-lg font-bold text-ink-900">
                {config.categoryNameAr}
              </h3>
              <Badge tone="neutral">{typeLabel}</Badge>
              {excellenceLabel && (
                <Badge tone="warning">معيار التمييز: {excellenceLabel}</Badge>
              )}
            </div>
            <p className="m-0 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-ar text-xs text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <ListChecks size={12} strokeWidth={1.75} aria-hidden />
                {num(conditionCount)} شرط مضاف
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers size={12} strokeWidth={1.75} aria-hidden />
                {config.singleAxis
                  ? `${config.yearCount} سنة دراسية`
                  : `${config.specializationCount} تخصص · ${config.yearCount} سنة دراسية`}
              </span>
            </p>
          </div>
          <CompletionBadge state={completion} />
        </div>
      </header>

      <div>
        {config.categoryType === 'university' ? (
          <GeneralRulesSection
            categoryCode={config.categoryCode}
            facultyCodes={config.categoryFacultyCodes}
            specializationCodes={config.categorySpecializationCodes}
            excellenceMode={excellenceMode}
          />
        ) : (
          <ThanawiRulesSection
            categoryCode={config.categoryCode}
            excellenceMode={excellenceMode}
          />
        )}
      </div>
    </div>
  );
}

interface CompletionMeta {
  tone: BadgeTone;
  label: string;
  icon: JSX.Element;
}

const COMPLETION_META: Record<CategoryCompletionState, CompletionMeta> = {
  complete: {
    tone: 'success',
    label: 'مكتمل',
    icon: <Check size={12} strokeWidth={2} aria-hidden />,
  },
  partial: {
    tone: 'warning',
    label: 'جزئي',
    icon: <CircleDashed size={12} strokeWidth={1.75} aria-hidden />,
  },
  empty: {
    tone: 'neutral',
    label: 'فارغ',
    icon: <Circle size={12} strokeWidth={1.75} aria-hidden />,
  },
};

function CompletionBadge({
  state,
}: {
  state: CategoryCompletionState;
}): JSX.Element {
  const meta = COMPLETION_META[state];
  return (
    <Badge tone={meta.tone} icon={meta.icon} className="shrink-0">
      {meta.label}
    </Badge>
  );
}
