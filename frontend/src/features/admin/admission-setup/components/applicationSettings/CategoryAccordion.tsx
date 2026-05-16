/**
 * CategoryAccordion — `@radix-ui/react-accordion` (multiple-open mode).
 *
 * Sources every applicant-category from the
 * `admin/lookups/applicant-categories` lookup (no hardcoded list). Each
 * row carries a `type` (`university` | `pre_university`) that decides
 * which editor section is rendered inside the accordion body:
 *
 *   • `university` (جامعي)     → <GeneralRulesSection /> — generalised
 *     faculty + specialization picker (1F/1S flat, 1F/NS accordion,
 *     >1F accordion-per-faculty).
 *   • `pre_university` (ثانوي) → <ThanawiRulesSection /> — exam-round +
 *     committee + graduation-year + school-category grid.
 *
 * Active toggle on the row uses the underlying
 * `ApplicantCategoryConfig.isActive` (mirrors the prior wiring); the
 * lookup row's `isActive` is the master flag for whether the category
 * is shown to applicants. Both stay in sync at this seam.
 */

import { useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, ListChecks } from 'lucide-react';
import {
  AlertDialog,
  ErrorState,
  LoadingState,
} from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import { useLookup } from '@/features/lookups';
import {
  useCategoryConfigs,
  useToggleCategoryActive,
} from '../../api/applicationSettings.queries';
import type { CategoryConfigJoined } from '../../api/applicationSettings.service';
import { GeneralRulesSection } from './GeneralRulesSection';
import { ThanawiRulesSection } from './ThanawiRulesSection';

export function CategoryAccordion(): JSX.Element {
  const configsQuery = useCategoryConfigs();
  const categoriesQuery = useLookup('applicant-categories');
  const [openIds, setOpenIds] = useState<string[]>([]);

  if (configsQuery.isLoading || categoriesQuery.isLoading) {
    return <LoadingState variant="list" />;
  }
  if (configsQuery.isError || categoriesQuery.isError || !configsQuery.data) {
    return (
      <ErrorState
        title="تعذر تحميل الفئات"
        description="حاول إعادة المحاولة بعد قليل."
        onRetry={() => {
          configsQuery.refetch();
          categoriesQuery.refetch();
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
  const configs = configsQuery.data.filter((c) =>
    lookupActiveCodes.has(c.categoryCode),
  );

  return (
    <Accordion.Root
      type="multiple"
      dir="rtl"
      value={openIds}
      onValueChange={setOpenIds}
      className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface-card"
    >
      {configs.map((config) => (
        <ConfigItem key={config.id} config={config} />
      ))}
    </Accordion.Root>
  );
}

interface ConfigItemProps {
  config: CategoryConfigJoined;
}

function ConfigItem({ config }: ConfigItemProps): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toggleMut = useToggleCategoryActive();

  const handleCheckedChange = (next: boolean): void => {
    if (config.isActive && !next && config.yearCount > 0) {
      setConfirmOpen(true);
      return;
    }
    toggleMut.mutate(config.id);
  };

  const typeLabel = config.categoryType === 'university' ? 'جامعي' : 'ثانوي';

  return (
    <Accordion.Item value={config.id} className="group">
      <Accordion.Header className="flex">
        <div className="flex w-full items-center gap-3 px-4 py-3">
          <Accordion.Trigger
            className="group flex flex-1 items-center justify-between gap-3 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <span className="flex items-center gap-2 font-ar text-base font-medium text-ink-900">
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                className="text-ink-500 transition-transform duration-fast group-data-[state=closed]:rotate-180"
                aria-hidden
              />
              {config.categoryNameAr}
              <span className="rounded-full bg-ink-50 px-2 py-0.5 text-2xs font-medium text-ink-600">
                {typeLabel}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-2xs text-ink-500">
              <ListChecks size={12} strokeWidth={1.75} aria-hidden />
              {config.singleAxis
                ? `${config.yearCount} سنة دراسية`
                : `${config.specializationCount} تخصص · ${config.yearCount} سنة دراسية`}
            </span>
          </Accordion.Trigger>
          <button
            type="button"
            role="switch"
            aria-checked={config.isActive}
            aria-label={`تفعيل فئة ${config.categoryNameAr}`}
            disabled={toggleMut.isPending}
            onClick={() => handleCheckedChange(!config.isActive)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-pill px-4 py-1.5 text-xs font-medium',
              'transition-colors duration-[var(--motion-fast)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              config.isActive
                ? 'border border-transparent text-white'
                : 'border border-border-default bg-white text-ink-600 hover:bg-ink-50',
              toggleMut.isPending && 'cursor-not-allowed opacity-60',
            )}
            style={config.isActive ? { background: 'var(--accent-600)' } : undefined}
          >
            {config.isActive ? 'مفعّل' : 'موقوف'}
          </button>
        </div>
      </Accordion.Header>

      <Accordion.Content className="border-t border-border-subtle bg-ink-50/30 px-4 py-3">
        {config.categoryType === 'university' ? (
          <GeneralRulesSection
            categoryCode={config.categoryCode}
            facultyCodes={config.categoryFacultyCodes}
            specializationCodes={config.categorySpecializationCodes}
          />
        ) : (
          <ThanawiRulesSection categoryCode={config.categoryCode} />
        )}
      </Accordion.Content>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="إيقاف الفئة"
        description={`هذه الفئة تحتوي على ${config.yearCount} سنة دراسية نشطة. سيرفض النظام الإيقاف حتى توقف السنوات النشطة أولاً.`}
        actionLabel="فهمت"
        onAction={() => setConfirmOpen(false)}
        tone="primary"
      />
    </Accordion.Item>
  );
}
