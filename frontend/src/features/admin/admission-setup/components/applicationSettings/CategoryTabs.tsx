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
 * The tab order mirrors the backend lookup order as-is. When backend
 * returns more categories than fit in the row, the tablist remains one
 * line and scrolls horizontally instead of wrapping.
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

export function CategoryTabs(): JSX.Element {
  const configsQuery = useCategoryConfigs();
  const categoriesQuery = useLookup('applicant-categories', applicationSettingsQueryOptions);
  const excellenceQuery = useLookup('excellence-criteria', applicationSettingsQueryOptions);

  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  if (
    configsQuery.isLoading ||
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
  );

  const excellenceRows = excellenceQuery.data ?? [];
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
          className="flex-nowrap gap-2 overflow-x-auto overflow-y-hidden border-b-0 pb-3"
        >
          {visibleConfigs.map((config) => (
            <ConfigTab
              key={config.id}
              config={config}
              excellenceLabels={resolveExcellenceCriteriaLabels(
                config.excellenceCriterion,
                excellenceRows,
              )}
            />
          ))}
        </Tabs.List>
      </div>

      {visibleConfigs.map((config) => (
        <Tabs.Panel key={config.id} value={config.id}>
          <div className="rounded-lg border border-border-subtle bg-ink-50/30 p-4 shadow-xs">
            <ConfigPanel
              config={config}
              excellenceMode={deriveExcellenceMode(
                config.excellenceCriterion,
                excellenceRows,
              )}
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
        'min-h-20 min-w-[14rem] max-w-[18rem] flex-shrink-0 items-start rounded-md border border-border-subtle bg-surface-card px-3 py-3 text-start',
        'hover:border-border-default hover:bg-ink-50/70',
        'data-[state=active]:border-[color:var(--accent-500)] data-[state=active]:bg-[color:var(--accent-50)]',
        'data-[state=active]:shadow-xs',
      )}
    >
      <span className="flex min-w-0 flex-col items-start gap-2">
        <span className="flex w-full min-w-0 items-start justify-between gap-3">
          <span className="min-w-0 truncate font-ar text-sm font-bold leading-6 text-ink-900">
            {config.categoryNameAr}
          </span>
          <CompletionBadge state={completion} compact />
        </span>
        <span className="flex max-w-full flex-wrap items-center gap-1.5">
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

function mergeCategoryConfigsWithActiveLookups(
  configs: readonly CategoryConfigJoined[],
  categories: readonly ApplicantCategoryRow[],
): CategoryConfigJoined[] {
  const activeCategories = categories.filter((category) => category.isActive);
  const configByCode = new Map(
    configs.map((config) => [config.categoryCode, config] as const),
  );

  return activeCategories.map((category, index) => {
    const config = configByCode.get(category.code);

    if (!config) {
      return {
        id: `lookup:${category.code}`,
        categoryId: category.code,
        categoryCode: category.code,
        categoryNameAr: category.name,
        categoryType: category.type,
        categoryFacultyCodes: category.facultyCodes,
        categorySpecializationCodes: category.specializationCodes,
        lockedGender:
          category.genderScope.length === 1 ? category.genderScope[0] : null,
        singleAxis: false,
        implicitSpecId: null,
        specializationCount: category.specializationCodes.length,
        yearCount: 0,
        excellenceCriterion: normalizeExcellenceCriteria(category.excellenceCriterion),
        isActive: true,
        sortOrder: index + 1,
        createdAt: '',
        updatedAt: '',
      };
    }

    return {
      ...config,
      categoryNameAr: category.name,
      categoryType: normalizeApplicantCategoryType(config.categoryType, category),
      categoryFacultyCodes: category.facultyCodes,
      categorySpecializationCodes: category.specializationCodes,
      lockedGender:
        category.genderScope.length === 1 ? category.genderScope[0] : null,
      excellenceCriterion: normalizeExcellenceCriteria(category.excellenceCriterion),
    };
  });
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
  config: CategoryConfigJoined;
  /** Resolved «معيار التمييز» discriminator — TAGDIR (تقدير) hides the
   *  score pair, GRADES (درجة) hides the grade pair. `null` (no
   *  criterion picked) keeps both pairs visible. */
  excellenceMode: ExcellenceMode | null;
}

function ConfigPanel({
  config,
  excellenceMode,
}: ConfigPanelProps): JSX.Element {
  return config.categoryType === 'university' ? (
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
