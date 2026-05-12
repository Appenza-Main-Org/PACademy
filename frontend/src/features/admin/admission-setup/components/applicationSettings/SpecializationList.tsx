/**
 * SpecializationList — body of one CategoryAccordion item.
 *
 * Renders one SpecializationRow per attached specialization plus an
 * "إضافة تخصص" button that opens `<AttachSpecializationDialog />`.
 * Lazy-mounted by the outer accordion (only renders when its parent is
 * open) so the per-config query fires only on demand.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/components';
import { useSpecializationsForConfig } from '../../api/applicationSettings.queries';
import { AttachSpecializationDialog } from './AttachSpecializationDialog';
import { SpecializationRow } from './SpecializationRow';

interface SpecializationListProps {
  configId: string;
}

export function SpecializationList({ configId }: SpecializationListProps): JSX.Element {
  const [attachOpen, setAttachOpen] = useState(false);
  const specsQuery = useSpecializationsForConfig(configId);
  const specs = specsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-3 py-3">
      {specsQuery.isLoading ? (
        <p className="font-ar text-sm text-ink-500">جارٍ تحميل التخصصات…</p>
      ) : specs.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-4 py-3 text-2xs text-ink-500">
          لا توجد تخصصات مربوطة بهذه الفئة بعد. اضغط "إضافة تخصص" لربط أول
          تخصص.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {specs.map((s) => (
            <li key={s.id}>
              <SpecializationRow configId={configId} row={s} />
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Plus size={14} strokeWidth={1.75} />}
          onClick={() => setAttachOpen(true)}
        >
          إضافة تخصص
        </Button>
      </div>

      <AttachSpecializationDialog
        configId={configId}
        open={attachOpen}
        onOpenChange={setAttachOpen}
      />
    </div>
  );
}
