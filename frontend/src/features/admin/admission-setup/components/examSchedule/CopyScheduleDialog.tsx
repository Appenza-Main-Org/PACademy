/**
 * CopyScheduleDialog — copy days from a source category into the
 * current (target) category for the same cycle.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Combobox, Switch, toast } from '@/shared/components';
import type { ActiveCategoryView } from '../../lib/activeCategories';
import {
  useCopyScheduleFromCategory,
  useExamScheduleDays,
} from '../../api/examSchedule.queries';

export interface CopyScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  /** The active tab — destination of the copy. */
  targetCategoryId: string;
  targetCategoryNameAr: string;
  /** Sibling categories the source picker is drawn from. */
  candidateSources: ActiveCategoryView[];
}

export function CopyScheduleDialog({
  open,
  onClose,
  cycleId,
  targetCategoryId,
  targetCategoryNameAr,
  candidateSources,
}: CopyScheduleDialogProps): JSX.Element {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState<boolean>(false);
  const copyMut = useCopyScheduleFromCategory();

  /* Reset source when the candidate set changes (e.g. another tab
   * deactivates while this dialog is open). */
  useEffect(() => {
    if (sourceId && !candidateSources.some((c) => c.id === sourceId)) {
      setSourceId(null);
    }
  }, [candidateSources, sourceId]);

  const sourceDaysQuery = useExamScheduleDays(cycleId, sourceId);
  const targetDaysQuery = useExamScheduleDays(cycleId, targetCategoryId);

  const stats = useMemo(() => {
    const sourceDays = sourceDaysQuery.data ?? [];
    const targetDates = new Set((targetDaysQuery.data ?? []).map((d) => d.date));
    let collisions = 0;
    for (const s of sourceDays) {
      if (targetDates.has(s.date)) collisions++;
    }
    return { sourceCount: sourceDays.length, collisions };
  }, [sourceDaysQuery.data, targetDaysQuery.data]);

  function close(): void {
    setSourceId(null);
    setOverwrite(false);
    onClose();
  }

  function submit(): void {
    if (!sourceId) return;
    copyMut.mutate(
      {
        cycleId,
        sourceCategoryId: sourceId,
        targetCategoryId,
        overwrite,
      },
      {
        onSuccess: (res) => {
          toast(
            `تم نسخ ${res.created} يوم${res.skipped > 0 ? ` (${res.skipped} تخطي)` : ''}`,
            'success',
          );
          close();
        },
      },
    );
  }

  const sourceLabel = sourceId
    ? candidateSources.find((c) => c.id === sourceId)?.nameAr ?? ''
    : '';

  return (
    <Modal
      open={open}
      onClose={close}
      title={`نسخ تقويم إلى ${targetCategoryNameAr}`}
      size="md"
      transparentBackdrop={false}
    >
      <div className="space-y-4 p-1">
        <Combobox
          label="الفئة المصدر"
          value={sourceId ?? ''}
          onChange={(v) => setSourceId(v && v.length > 0 ? v : null)}
          options={candidateSources.map((c) => ({ value: c.id, label: c.nameAr }))}
          placeholder="اختر الفئة المصدر"
        />
        <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink-900">استبدال الأيام الموجودة</p>
            <p className="text-2xs text-ink-500">
              عند الإيقاف يتم نسخ الأيام غير الموجودة فقط وتخطي المتعارضة.
            </p>
          </div>
          <Switch
            checked={overwrite}
            onCheckedChange={setOverwrite}
            aria-label="استبدال الأيام الموجودة"
          />
        </div>
        {sourceId ? (
          <div className="rounded-md border border-dashed border-border-subtle bg-bg-muted/40 p-3 text-2xs text-ink-700">
            سيتم نسخ {stats.sourceCount} يوم من {sourceLabel}.{' '}
            {stats.collisions > 0
              ? `${stats.collisions} يوم مسجل بالفعل في ${targetCategoryNameAr} — ${overwrite ? 'سيُستبدل' : 'سيُتخطى'}.`
              : 'لا يوجد تعارض في التواريخ.'}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={!sourceId}
            isLoading={copyMut.isPending}
          >
            نسخ
          </Button>
        </div>
      </div>
    </Modal>
  );
}
