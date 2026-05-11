/**
 * AttachSpecializationDialog — adds a specialization lookup row to the
 * given category config. Single-step pick; commit fires
 * `useAttachSpecialization` and closes on success.
 *
 * Eligible specializations come from `useEligibleSpecializations(configId)`
 * which returns the `specializations` lookup rows not already attached to
 * this config. V1 has no category↔specialization mapping (see
 * `applicationSettings.service.ts` header), so every active lookup row
 * is offered. When the lookup mapping ships, the service narrows the
 * result and the dialog body remains unchanged.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Combobox, Dialog, EmptyState } from '@/shared/components';
import {
  useAttachSpecialization,
  useEligibleSpecializations,
} from '../../api/applicationSettings.queries';

interface AttachSpecializationDialogProps {
  configId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

const LOOKUP_MAPPING_URL = '/admin/lookups/applicant-categories';

export function AttachSpecializationDialog({
  configId,
  open,
  onOpenChange,
}: AttachSpecializationDialogProps): JSX.Element {
  const [picked, setPicked] = useState<string | null>(null);
  const eligibleQuery = useEligibleSpecializations(configId, open);
  const attachMut = useAttachSpecialization();

  /* Reset selection whenever the dialog opens fresh. */
  useEffect(() => {
    if (open) setPicked(null);
  }, [open]);

  const options = (eligibleQuery.data ?? []).map((s) => ({
    value: s.code,
    label: s.name,
    badge: s.code,
  }));
  const isEmpty = !eligibleQuery.isLoading && options.length === 0;
  const isLoading = eligibleQuery.isLoading;

  const handleAttach = (): void => {
    if (!picked) return;
    attachMut.mutate(
      { configId, specializationId: picked },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="إضافة تخصص"
      description="اختر تخصصاً من الأكواد المرجعية لربطه بهذه الفئة."
      size="sm"
      footer={
        !isEmpty ? (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={handleAttach}
              disabled={!picked || attachMut.isPending}
              isLoading={attachMut.isPending}
            >
              ربط التخصص
            </Button>
          </div>
        ) : null
      }
    >
      {isLoading ? (
        <p className="font-ar text-sm text-ink-500">جارٍ تحميل التخصصات…</p>
      ) : isEmpty ? (
        <EmptyState
          variant="generic"
          title="لا توجد تخصصات قابلة للربط"
          description="إما أن جميع التخصصات مرتبطة بهذه الفئة، أو لم يتم تعريف تخصصات في الأكواد المرجعية بعد. أضف التخصصات أولاً من البيانات المرجعية."
          action={
            <Link to={LOOKUP_MAPPING_URL} className="inline-flex">
              <Button
                variant="secondary"
                trailingIcon={
                  <ArrowLeft
                    size={14}
                    strokeWidth={1.75}
                    className="rtl:scale-x-[-1]"
                  />
                }
              >
                افتح إدارة البيانات المرجعية
              </Button>
            </Link>
          }
        />
      ) : (
        <Combobox
          value={picked}
          onChange={setPicked}
          options={options}
          label="التخصص"
          placeholder="اختر تخصصاً…"
        />
      )}
    </Dialog>
  );
}
