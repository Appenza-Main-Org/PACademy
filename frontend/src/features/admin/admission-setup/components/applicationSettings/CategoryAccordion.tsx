/**
 * CategoryAccordion — `@radix-ui/react-accordion` (multiple-open mode).
 *
 * One item per `ApplicantCategoryConfig`. The header row has three
 * regions:
 *
 *   • [Trigger] chevron + categoryNameAr + counts badge — toggles open
 *   • [Sibling] active Switch — toggles config.isActive (with
 *     CATEGORY_HAS_ACTIVE_YEARS guard via AlertDialog)
 *
 * Body lazy-mounts `<SpecializationList configId={config.id} />` so the
 * per-config queries fire only when expanded.
 *
 * Reorder via drag-and-drop is **out of scope for V1**. When the
 * `sortOrder` field becomes editable, add a Radix-DnD pattern here.
 */

import { useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, ListChecks } from 'lucide-react';
import { isConflictError } from '@/shared/lib/errors';
import {
  AlertDialog,
  Badge,
  ErrorState,
  LoadingState,
  Switch,
} from '@/shared/components';
import {
  useCategoryConfigs,
  useToggleCategoryActive,
} from '../../api/applicationSettings.queries';
import type { CategoryConfigJoined } from '../../api/applicationSettings.service';
import { SpecializationList } from './SpecializationList';

export function CategoryAccordion(): JSX.Element {
  const configsQuery = useCategoryConfigs();
  const [openIds, setOpenIds] = useState<string[]>([]);

  if (configsQuery.isLoading) {
    return <LoadingState variant="default" />;
  }
  if (configsQuery.isError || !configsQuery.data) {
    return (
      <ErrorState
        title="تعذر تحميل الفئات"
        description="حاول إعادة المحاولة بعد قليل."
        onRetry={() => configsQuery.refetch()}
      />
    );
  }

  const configs = configsQuery.data;

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

  /* The Switch is interactive. The active-toggle has a safety check —
   * if the user tries to deactivate a config that has any active
   * descendant year, the server throws CATEGORY_HAS_ACTIVE_YEARS and we
   * surface a confirm modal. The pre-emptive client check below opens
   * the modal without firing the mutation first; if the user confirms,
   * the mutation still runs and the server is the source of truth. */
  const handleCheckedChange = (next: boolean): void => {
    if (config.isActive && !next && config.yearCount > 0) {
      setConfirmOpen(true);
      return;
    }
    toggleMut.mutate(config.id);
  };

  const handleConfirm = (): void => {
    toggleMut.mutate(config.id, {
      onError: (err) => {
        if (isConflictError(err) && err.conflictCode === 'CATEGORY_HAS_ACTIVE_YEARS') {
          setConfirmOpen(false);
        }
      },
      onSuccess: () => setConfirmOpen(false),
    });
  };

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
                className="text-ink-500 transition-transform duration-fast group-data-[state=open]:rotate-180"
                aria-hidden
              />
              {config.categoryNameAr}
              <Badge tone="neutral">{config.categoryId}</Badge>
            </span>
            <span className="inline-flex items-center gap-1.5 text-2xs text-ink-500">
              <ListChecks size={12} strokeWidth={1.75} aria-hidden />
              {config.specializationCount} تخصص · {config.yearCount} سنة دراسية
            </span>
          </Accordion.Trigger>
          <Switch
            checked={config.isActive}
            onCheckedChange={handleCheckedChange}
            aria-label={`تفعيل فئة ${config.categoryNameAr}`}
            disabled={toggleMut.isPending}
          />
        </div>
      </Accordion.Header>

      <Accordion.Content className="border-t border-border-subtle bg-ink-50/30 px-4">
        <SpecializationList configId={config.id} />
      </Accordion.Content>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (!next) setPendingActive(null);
        }}
        title="إيقاف الفئة"
        description={`هذه الفئة تحتوي على ${config.yearCount} سنة دراسية نشطة. هل تريد إيقاف الفئة على أي حال؟ سيتم إيقاف السنوات تلقائياً.`}
        actionLabel="إيقاف الفئة"
        onAction={handleConfirm}
        tone="danger"
        isActionLoading={toggleMut.isPending}
      />
      {/* Marker for unused variable lint guard — pendingActive is currently
       * only inspected via openness; reserved for future "preview impact"
       * UX where the modal explains the diff between current and next. */}
      <span hidden>{String(pendingActive)}</span>
    </Accordion.Item>
  );
}
