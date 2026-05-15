/**
 * SpecializationRow — Radix Collapsible inside the outer CategoryAccordion.
 *
 * Header: spec nameAr + year count badge + detach action (cascade-confirm).
 * Body : `<YearTable categorySpecializationId={row.id} />`.
 *
 * The collapsible is intentionally a separate Radix primitive — nesting a
 * second Radix Accordion inside the outer one would force every spec into
 * a single-open or fight the outer multiple-open mode. Per-row
 * collapsibles read more naturally and keep keyboard focus simple.
 */

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, Trash2 } from 'lucide-react';
import { AlertDialog, Button } from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import {
  useDetachSpecialization,
} from '../../api/applicationSettings.queries';
import type { CategorySpecializationJoined } from '../../api/applicationSettings.service';
import { YearTable } from './YearTable';

interface SpecializationRowProps {
  configId: string;
  row: CategorySpecializationJoined;
}

export function SpecializationRow({
  configId,
  row,
}: SpecializationRowProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const detachMut = useDetachSpecialization(configId);

  const handleDetach = (): void => {
    detachMut.mutate(row.id, {
      onSuccess: () => setConfirmOpen(false),
    });
  };

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="rounded-md border border-border-subtle bg-surface-card">
      <div className="flex items-center gap-2 px-4 py-3">
        <Collapsible.Trigger
          className={cn(
            'group flex flex-1 items-center justify-between gap-3 rounded-md text-start',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          )}
        >
          <span className="flex items-center gap-2 font-ar text-sm font-medium text-ink-900">
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className="text-ink-500 transition-transform duration-fast group-data-[state=open]:rotate-180"
              aria-hidden
            />
            {row.specializationNameAr}
          </span>
          <span className="inline-flex items-center gap-2 text-2xs text-ink-500">
            <span>{row.yearCount} سنة دراسية</span>
          </span>
        </Collapsible.Trigger>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          leadingIcon={<Trash2 size={14} strokeWidth={1.75} className="text-terra-600" />}
          aria-label="فصل التخصص"
        >
          فصل
        </Button>
      </div>

      <Collapsible.Content className="border-t border-border-subtle px-4 py-3">
        <YearTable categorySpecializationId={row.id} />
      </Collapsible.Content>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="فصل التخصص"
        description={
          row.yearCount > 0
            ? `سيتم حذف ${row.yearCount} سنة دراسية مرتبطة بهذا التخصص. لا يمكن التراجع.`
            : 'سيتم فصل هذا التخصص عن الفئة. لا يمكن التراجع.'
        }
        actionLabel="فصل التخصص"
        onAction={handleDetach}
        tone="danger"
        isActionLoading={detachMut.isPending}
      />
    </Collapsible.Root>
  );
}
