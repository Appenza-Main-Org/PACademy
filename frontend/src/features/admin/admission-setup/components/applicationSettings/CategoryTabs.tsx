/**
 * CategoryTabs — backend-driven category tabs for step 1.
 *
 * Sources every applicant-category from the
 * `admin/lookups/applicant-categories` lookup (no hardcoded list). Each
 * row carries a `type` (`university` | `pre_university`) that decides
 * which editor section is rendered inside the active tab panel:
 *
 *   • `university` (جامعي)     → <GeneralRulesSection /> — implicit
 *     single-form categories stay compact; `specialized_officers` gets
 *     the faculty/specialization bulk workspace.
 *   • `pre_university` (ثانوي) → <ThanawiRulesSection /> — exam-round +
 *     committee + graduation-year + school-category grid.
 *
 * The tab order mirrors the backend lookup order as-is. The tablist
 * uses an auto-fit CSS grid (`minmax(12rem, 1fr)`) so every configured
 * category is visible without a horizontal scrollbar — tabs reflow into
 * additional rows on narrow viewports instead of clipping behind a
 * scroll spine.
 *
 * «معيار التمييز» rendering:
 *   • Every active category renders here regardless of its criterion
 *     state — admins still need to author the rest of the rules.
 *   • Criterion labels on the row header only show when the category
 *     carries one or more selected criteria.
 *     Otherwise the label is hidden and the rest of the header (name +
 *     stage badge + counts + completion badge) renders normally.
 */

import { useMemo, useState } from 'react';
import {
  Check,
  Circle,
  CircleDashed,
} from 'lucide-react';
import { ErrorState, LoadingState, Tabs } from '@/shared/components';
import {
  normalizeExcellenceCriteria,
  resolveExcellenceCriteriaLabels,
  useLookup,
  type ApplicantCategoryGenderScope,
  type ApplicantCategoryRow,
  type ApplicantCategoryType,
} from '@/features/lookups';
import { cn } from '@/shared/lib/cn';
import {
  applicationSettingsQueryOptions,
  useCategoryConfigs,
} from '../../api/applicationSettings.queries';
import type { CategoryConfigJoined } from '../../api/applicationSettings.service';
import {
  deriveExcellenceModes,
  type ExcellenceMode,
} from '../../lib/excellenceMode';
import { useAdmissionSetupCycle } from '../../hooks/useAdmissionSetupCycle';
import {
  selectCategoryCompletion,
  useAdmissionSetupWizardStore,
  type CategoryCompletionState,
} from '../../store/wizardSharedState';
import { GeneralRulesSection } from './GeneralRulesSection';
import { ThanawiRulesSection } from './ThanawiRulesSection';

export function CategoryTabs(): JSX.Element {
  const { cycle, isInitialised } = useAdmissionSetupCycle();
  const cycleId = cycle?.id ?? null;
  const configsQuery = useCategoryConfigs(isInitialised, cycleId);
  const categoriesQuery = useLookup('applicant-categories', applicationSettingsQueryOptions);
  const excellenceQuery = useLookup('excellence-criteria', applicationSettingsQueryOptions);

  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  if (
    configsQuery.isLoading ||
    !isInitialised ||
    categoriesQuery.isLoading ||
    excellenceQuery.isLoading
  ) {
    return <LoadingState variant="list" />;
  }
  if (
    configsQuery.isError ||
    categoriesQuery.isError ||
    excellenceQuery.isError ||
    !configsQuery.data
  ) {
    return (
      <ErrorState
        error={
          configsQuery.error ??
          categoriesQuery.error ??
          excellenceQuery.error
        }
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

  /* Every active category renders here. Criterion labels on the
   * row header only appear when the category carries selections — categories
   * without a criterion still need to be editable (admins set the rest
   * of the rules regardless), so the row stays visible. */
  const visibleConfigs = mergeCategoryConfigsWithActiveLookups(
    configsQuery.data,
    categoriesQuery.data ?? [],
    excellenceQuery.data ?? [],
  );

  const selectedId = activeId && visibleConfigs.some((config) => config.id === activeId)
    ? activeId
    : visibleConfigs[0]?.id;

  if (!selectedId) {
    return (
      <ErrorState
        title="لا توجد فئات نشطة"
        description="فعّل فئة واحدة على الأقل من دليل فئات المتقدمين ثم عُد إلى إعدادات التقديم."
        onRetry={() => {
          configsQuery.refetch();
          categoriesQuery.refetch();
          excellenceQuery.refetch();
        }}
      />
    );
  }

  return (
    <Tabs
      value={selectedId}
      onValueChange={setActiveId}
      activationMode="automatic"
      className="gap-4"
    >
      <div className="rounded-lg border border-border-subtle bg-surface-card px-3 pt-3 shadow-xs">
        <Tabs.List
          aria-label="فئات إعدادات التقديم"
          className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2 overflow-visible border-b-0 pb-3"
        >
          {visibleConfigs.map((config) => (
            <ConfigTab
              key={config.id}
              config={config}
              excellenceLabels={config.lookupExcellenceLabels}
            />
          ))}
        </Tabs.List>
      </div>

      {visibleConfigs.map((config) => (
        <Tabs.Panel key={config.id} value={config.id}>
          <div className="rounded-lg border border-border-subtle bg-ink-50/30 p-4 shadow-xs">
            <ConfigPanel
              config={config}
              excellenceMode={config.lookupExcellenceMode}
              allowedExcellenceModes={config.allowedExcellenceModes}
            />
          </div>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

interface ConfigTabProps {
  config: CategoryConfigJoined;
  excellenceLabels: readonly string[];
}

function ConfigTab({
  config,
  excellenceLabels,
}: ConfigTabProps): JSX.Element {
  const completion = useCategoryCompletion(config);
  const typeLabel = config.categoryType === 'university' ? 'جامعي' : 'ثانوي';

  return (
    <Tabs.Tab
      value={config.id}
      className={cn(
        'h-auto min-h-24 w-full min-w-0 items-start rounded-md border border-border-subtle bg-surface-card px-3 py-3 text-start',
        'hover:border-border-default hover:bg-ink-50/70',
        'data-[state=active]:border-[color:var(--accent-500)] data-[state=active]:bg-[color:var(--accent-50)]',
        'data-[state=active]:shadow-xs',
      )}
    >
      <span className="flex w-full min-w-0 flex-col items-start gap-2">
        <span className="block w-full min-w-0 truncate font-ar text-sm font-bold leading-6 text-ink-900">
          {config.categoryNameAr}
        </span>
        <span className="flex w-full max-w-full flex-wrap items-center gap-1.5">
          <CompletionBadge state={completion} compact />
          <span className="rounded-full bg-ink-50 px-2 py-0.5 font-ar text-2xs font-medium text-ink-600">
            {typeLabel}
          </span>
          {excellenceLabels.length > 0 && (
            <span
              className="max-w-full truncate rounded-full bg-gold-50 px-2 py-0.5 font-ar text-2xs font-medium text-gold-700"
              aria-label={`معيار التمييز: ${excellenceLabels.join('، ')}`}
            >
              معيار التمييز: {excellenceLabels.join('، ')}
            </span>
          )}
        </span>
      </span>
    </Tabs.Tab>
  );
}

type CategoryConfigWithLookupMode = CategoryConfigJoined & {
  lookupExcellenceMode: ExcellenceMode | null;
  allowedExcellenceModes: readonly ExcellenceMode[];
  lookupExcellenceLabels: readonly string[];
  lookupGenderScope: readonly ApplicantCategoryGenderScope[];
};

function mergeCategoryConfigsWithActiveLookups(
  configs: readonly CategoryConfigJoined[],
  categories: readonly ApplicantCategoryRow[],
  excellenceRows: Parameters<typeof deriveExcellenceModes>[1],
): CategoryConfigWithLookupMode[] {
  const activeCategories = categories.filter((category) => category.isActive);
  const configByCode = new Map(
    configs.map((config) => [config.categoryCode, config] as const),
  );

  return activeCategories.map((category, index) => {
    const config = configByCode.get(category.code);
    const allowedExcellenceModes = deriveExcellenceModes(
      category.excellenceCriterion,
      excellenceRows,
    );
    const lookupExcellenceMode =
      allowedExcellenceModes.length === 1 ? allowedExcellenceModes[0] : null;
    const lookupExcellenceLabels = allowedExcellenceModes.length > 0
      ? allowedExcellenceModes.map(excellenceModeLabel)
      : resolveExcellenceCriteriaLabels(category.excellenceCriterion, excellenceRows);
    const lookupGenderScope = normalizeApplicantCategoryGenderScope(category);
    const lockedGender = lookupGenderScope.length === 1 ? lookupGenderScope[0] : null;

    if (!config) {
      return {
        id: `lookup:${category.code}`,
        categoryId: category.code,
        categoryCode: category.code,
        categoryNameAr: category.name,
        categoryType: category.type,
        categoryFacultyCodes: category.facultyCodes,
        categorySpecializationCodes: category.specializationCodes,
        lockedGender,
        singleAxis: false,
        implicitSpecId: null,
        specializationCount: category.specializationCodes.length,
        yearCount: 0,
        excellenceCriterion: normalizeExcellenceCriteria(category.excellenceCriterion),
        isActive: true,
        sortOrder: index + 1,
        createdAt: '',
        updatedAt: '',
        lookupExcellenceMode,
        allowedExcellenceModes,
        lookupExcellenceLabels,
        lookupGenderScope,
      };
    }

    return {
      ...config,
      categoryNameAr: category.name,
      categoryType: normalizeApplicantCategoryType(config.categoryType, category),
      categoryFacultyCodes: category.facultyCodes,
      categorySpecializationCodes: category.specializationCodes,
      lockedGender,
      excellenceCriterion: normalizeExcellenceCriteria(category.excellenceCriterion),
      lookupExcellenceMode,
      allowedExcellenceModes,
      lookupExcellenceLabels,
      lookupGenderScope,
    };
  });
}

function excellenceModeLabel(mode: ExcellenceMode): string {
  return mode === 'TAGDIR' ? 'تقدير' : 'درجة';
}

function genderScopeForConfig(
  config: CategoryConfigWithLookupMode,
): readonly ApplicantCategoryGenderScope[] {
  if (config.lookupGenderScope.length > 0) return config.lookupGenderScope;
  return config.lockedGender ? [config.lockedGender] : ['male', 'female'];
}

function normalizeApplicantCategoryGenderScope(
  category: ApplicantCategoryRow,
): readonly ApplicantCategoryGenderScope[] {
  const row = category as ApplicantCategoryRow & {
    genderScope?: unknown;
    conditions?: { gender?: unknown };
  };
  const fromScope = normalizeGenderValues(row.genderScope);
  if (fromScope.length > 0) return fromScope;

  const fromConditions = normalizeGenderValues(row.conditions?.gender);
  return fromConditions.length > 0 ? fromConditions : ['male', 'female'];
}

function normalizeGenderValues(value: unknown): ApplicantCategoryGenderScope[] {
  if (Array.isArray(value)) {
    return uniqueGenderValues(value.flatMap((item) => normalizeGenderValues(item)));
  }
  if (typeof value !== 'string') return [];

  const normalized = value.trim().toLowerCase();
  if (normalized === 'male' || normalized === 'ذكر' || normalized === 'ذكور') {
    return ['male'];
  }
  if (
    normalized === 'female' ||
    normalized === 'أنثى' ||
    normalized === 'انثى' ||
    normalized === 'إناث' ||
    normalized === 'اناث'
  ) {
    return ['female'];
  }
  if (
    normalized === 'any' ||
    normalized === 'all' ||
    normalized === 'both' ||
    normalized === 'الكل'
  ) {
    return ['male', 'female'];
  }
  return [];
}

function uniqueGenderValues(
  values: readonly ApplicantCategoryGenderScope[],
): ApplicantCategoryGenderScope[] {
  const result: ApplicantCategoryGenderScope[] = [];
  for (const value of values) {
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

function normalizeApplicantCategoryType(
  value: unknown,
  category?: ApplicantCategoryRow,
): ApplicantCategoryType {
  if (value === 'pre_university' || value === 'ثانوي') return 'pre_university';
  if (value === 'university' || value === 'جامعي') return 'university';
  if (category?.type === 'pre_university' || category?.type === 'university') {
    return category.type;
  }
  return 'university';
}

interface ConfigPanelProps {
  config: CategoryConfigWithLookupMode;
  /** Resolved single «معيار التمييز» discriminator. `null` means the
   *  category allows multiple modes or has not been configured yet. */
  excellenceMode: ExcellenceMode | null;
  allowedExcellenceModes: readonly ExcellenceMode[];
}

function ConfigPanel({
  config,
  excellenceMode,
  allowedExcellenceModes,
}: ConfigPanelProps): JSX.Element {
  return config.categoryType === 'university' ? (
    <GeneralRulesSection
      categoryCode={config.categoryCode}
      facultyCodes={config.categoryFacultyCodes}
      specializationCodes={config.categorySpecializationCodes}
      genderScope={genderScopeForConfig(config)}
      excellenceMode={excellenceMode}
      allowedExcellenceModes={allowedExcellenceModes}
    />
  ) : (
    <ThanawiRulesSection
      categoryCode={config.categoryCode}
      excellenceMode={excellenceMode}
      allowedExcellenceModes={allowedExcellenceModes}
    />
  );
}

function useCategoryCompletion(config: CategoryConfigJoined): CategoryCompletionState {
  /* Selector reads both buckets — see `selectCategoryCompletion` JSDoc.
   * Authored rows that haven't been promoted via the section-level
   * «اعتماد» button still count, so the badge tracks what the admin
   * sees in the grid. */
  const local = useAdmissionSetupWizardStore((s) => s.local);
  const approved = useAdmissionSetupWizardStore((s) => s.approved);

  const completion = useMemo(
    () =>
      selectCategoryCompletion(
        config.categoryCode,
        config.categoryType,
        [...local, ...approved],
        config.categorySpecializationCodes,
      ),
    [
      local,
      approved,
      config.categoryCode,
      config.categoryType,
      config.categorySpecializationCodes,
    ],
  );

  return completion;
}

interface CompletionMeta {
  label: string;
  icon: JSX.Element;
  className: string;
  iconClassName: string;
}

const COMPLETION_META: Record<CategoryCompletionState, CompletionMeta> = {
  complete: {
    label: 'مكتمل',
    icon: <Check size={12} strokeWidth={2} aria-hidden />,
    className: 'border-success/30 bg-success-bg text-success ring-1 ring-success/10',
    iconClassName: 'bg-success text-surface-card',
  },
  partial: {
    label: 'غير مكتمل',
    icon: <CircleDashed size={12} strokeWidth={1.75} aria-hidden />,
    className: 'border-gold-200 bg-gold-50 text-gold-700 ring-1 ring-gold-500/10',
    iconClassName: 'bg-gold-500 text-surface-card',
  },
  empty: {
    label: 'غير مكتمل',
    icon: <Circle size={12} strokeWidth={1.75} aria-hidden />,
    className: 'border-border-subtle bg-ink-50 text-ink-700 ring-1 ring-ink-500/10',
    iconClassName: 'bg-surface-card text-ink-500 ring-1 ring-border-strong',
  },
};

function CompletionBadge({
  state,
  compact = false,
}: {
  state: CategoryCompletionState;
  compact?: boolean;
}): JSX.Element {
  const meta = COMPLETION_META[state];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-pill border px-2.5 py-1.5 font-ar text-2xs font-semibold leading-none',
        compact && 'gap-1.5 px-2 py-1',
        meta.className,
      )}
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full',
          compact && 'size-4',
          meta.iconClassName,
        )}
      >
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}
