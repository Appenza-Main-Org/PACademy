/**
 * CategoryAccordion — `@radix-ui/react-accordion` (multiple-open mode).
 *
 * Sources every applicant-category from the
 * `admin/lookups/applicant-categories` lookup (no hardcoded list). Each
 * row carries a `type` (`university` | `pre_university`) that decides
 * which editor section is rendered inside the accordion body:
 *
 *   • `university` (جامعي)     → <GeneralRulesSection /> — implicit
 *     single-form categories stay compact; `specialized_officers` gets
 *     the faculty/specialization bulk workspace.
 *   • `pre_university` (ثانوي) → <ThanawiRulesSection /> — exam-round +
 *     committee + graduation-year + school-category grid.
 *
 * Active toggle on the row uses the underlying
 * `ApplicantCategoryConfig.isActive` (mirrors the prior wiring); the
 * lookup row's `isActive` is the master flag for whether the category
 * is shown to applicants. Both stay in sync at this seam.
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
  ChevronDown,
  Circle,
  CircleDashed,
  ListChecks,
} from 'lucide-react';
import { Accordion, Badge, ErrorState, LoadingState } from '@/shared/components';
import type { BadgeTone } from '@/shared/components';
import { useLookup } from '@/features/lookups';
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

  const [openIds, setOpenIds] = useState<string[]>([]);

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

  /* Filter to active lookup rows then preserve the configs' sortOrder.
   * The join carries `categoryType`/`categoryFacultyCodes`/
   * `categorySpecializationCodes` straight off the lookup so feature
   * components don't have to read the lookup themselves. */
  const lookupActiveCodes = new Set(
    (categoriesQuery.data ?? []).filter((c) => c.isActive).map((c) => c.code),
  );
  const activeConfigs = configsQuery.data.filter((c) =>
    lookupActiveCodes.has(c.categoryCode),
  );

  /* Every active category renders here. The criterion label on the
   * row header only appears when the category carries one — categories
   * without a criterion still need to be editable (admins set the rest
   * of the rules regardless), so the row stays visible. */
  const visibleConfigs = activeConfigs;

  const criterionLabelByCode = new Map(
    (excellenceQuery.data ?? []).map((row) => [row.code, row.name] as const),
  );
  const excellenceRows = excellenceQuery.data ?? [];

  return (
    <Accordion.Root
      type="multiple"
      dir="rtl"
      value={openIds}
      onValueChange={setOpenIds}
      className="flex flex-col gap-3"
    >
      {visibleConfigs.map((config) => (
        <ConfigItem
          key={config.id}
          config={config}
          excellenceLabel={
            /* Label only renders when the category actually carries a
             * criterion. The row itself stays visible either way. */
            config.excellenceCriterion === null
              ? null
              : criterionLabelByCode.get(config.excellenceCriterion) ??
                config.excellenceCriterion
          }
          excellenceMode={deriveExcellenceMode(
            config.excellenceCriterion,
            excellenceRows,
          )}
        />
      ))}
    </Accordion.Root>
  );
}

interface ConfigItemProps {
  config: CategoryConfigJoined;
  excellenceLabel: string | null;
  /** Resolved «معيار التمييز» discriminator — TAGDIR (تقدير) hides the
   *  score pair, GRADES (درجة) hides the grade pair. `null` (no
   *  criterion picked) keeps both pairs visible. */
  excellenceMode: ExcellenceMode | null;
}

function ConfigItem({
  config,
  excellenceLabel,
  excellenceMode,
}: ConfigItemProps): JSX.Element {
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

  const typeLabel = config.categoryType === 'university' ? 'جامعي' : 'ثانوي';

  return (
    <Accordion.Item
      value={config.id}
      className="group overflow-hidden rounded-lg border border-border-subtle bg-surface-card shadow-xs transition-colors duration-fast data-[state=open]:border-teal-100"
    >
      <Accordion.Header className="flex">
        <div className="flex w-full items-center gap-3 px-5 py-4">
          <Accordion.Trigger
            className="group flex min-w-0 flex-1 items-center justify-between gap-4 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <span className="flex min-w-0 items-start gap-3">
              <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-600 transition-colors duration-fast group-data-[state=open]:bg-teal-50 group-data-[state=open]:text-teal-700">
                <ChevronDown
                  size={15}
                  strokeWidth={2}
                  className="transition-transform duration-fast group-data-[state=closed]:rotate-180"
                  aria-hidden
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-ar text-lg font-bold leading-7 text-ink-900">
                  {config.categoryNameAr}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-ink-50 px-2 py-0.5 font-ar text-2xs font-medium text-ink-600">
                    {typeLabel}
                  </span>
                  {excellenceLabel && (
                    <span
                      className="rounded-full bg-gold-50 px-2 py-0.5 font-ar text-2xs font-medium text-gold-700"
                      aria-label={`معيار التمييز: ${excellenceLabel}`}
                    >
                      معيار التمييز: {excellenceLabel}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 font-ar text-2xs text-ink-600">
                    <ListChecks size={11} strokeWidth={1.75} aria-hidden />
                    {config.singleAxis
                      ? `${config.yearCount} سنة دراسية`
                      : `${config.specializationCount} تخصص · ${config.yearCount} سنة دراسية`}
                  </span>
                </span>
              </span>
            </span>
          </Accordion.Trigger>
          <CompletionBadge state={completion} />
        </div>
      </Accordion.Header>

      <Accordion.Content className="border-t border-border-subtle bg-ink-50/30 p-4">
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
      </Accordion.Content>
    </Accordion.Item>
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
