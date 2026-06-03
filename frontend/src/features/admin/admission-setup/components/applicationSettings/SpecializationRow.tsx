/**
 * SpecializationRow — one-item shared Accordion inside the active CategoryTabs panel.
 *
 * Header: spec nameAr + year count badge + detach action (cascade-confirm).
 * Body : `<YearTable categorySpecializationId={row.id} />`.
 *
 * Each row owns its own Accordion root so open state stays local to the
 * specialization and does not fight the outer category accordion.
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Accordion, AlertDialog, Button } from '@/shared/components';
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
    <Accordion
      type="single"
      collapsible
      value={open ? row.id : undefined}
      onValueChange={(value) => setOpen(value === row.id)}
      className="rounded-md border border-border-subtle bg-surface-card"
    >
      <Accordion.Item value={row.id}>
        <Accordion.HeaderRow
          className="px-4"
          trigger={
            <span className="flex items-center gap-2 font-ar text-sm font-medium text-ink-900">
            {row.specializationNameAr}
              <span className="text-2xs font-normal text-ink-500">
                {row.yearCount} سنة دراسية
              </span>
            </span>
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              leadingIcon={<Trash2 size={14} strokeWidth={1.75} className="text-terra-600" />}
              aria-label="فصل التخصص"
            >
              فصل
            </Button>
          }
        />

        <Accordion.Content className="border-t border-border-subtle px-4 py-3">
          <YearTable categorySpecializationId={row.id} />
        </Accordion.Content>
      </Accordion.Item>

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
    </Accordion>
  );
}
