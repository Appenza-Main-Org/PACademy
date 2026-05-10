/**
 * LifecycleActions — activate / extend / close / archive buttons for a cycle.
 *
 * Pure presentational + dispatch — the parent owns the modal and the
 * mutation calls. Extracted from `CycleDetailPage` so the Admission Setup
 * "حالة التقديم" step can render the same surface.
 */

import { Archive, CalendarPlus, PauseCircle, PlayCircle } from 'lucide-react';
import { Badge, Button, Card, IconStamp } from '@/shared/components';
import type { AdmissionCycle } from '@/shared/types/domain';

interface LifecycleActionsProps {
  cycle: AdmissionCycle;
  onRequest: (next: 'activate' | 'close' | 'archive') => void;
  onExtend: () => void;
}

export function LifecycleActions({
  cycle,
  onRequest,
  onExtend,
}: LifecycleActionsProps): JSX.Element {
  const isActive = cycle.status === 'active' || cycle.status === 'open' || cycle.status === 'extended';
  const isClosed = cycle.status === 'closed' || cycle.status === 'finalized' || cycle.status === 'processing';
  const isArchived = cycle.status === 'archived';

  return (
    <section>
      <Card variant="elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-ar-display text-md font-bold text-ink-900">إجراءات الدورة</h3>
            <p className="mt-0.5 text-2xs text-ink-500">
              تفعيل / إغلاق / أرشفة هذه الدورة
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isActive && !isArchived && (
              <Button
                variant="primary"
                leadingIcon={<PlayCircle size={14} strokeWidth={1.75} />}
                onClick={() => onRequest('activate')}
              >
                تفعيل
              </Button>
            )}
            {isActive && (
              <Button
                variant="ghost"
                leadingIcon={<CalendarPlus size={14} strokeWidth={1.75} />}
                onClick={onExtend}
              >
                تمديد
              </Button>
            )}
            {isActive && (
              <Button
                variant="secondary"
                leadingIcon={<PauseCircle size={14} strokeWidth={1.75} />}
                onClick={() => onRequest('close')}
              >
                إغلاق
              </Button>
            )}
            {isClosed && (
              <Button
                variant="ghost"
                leadingIcon={<Archive size={14} strokeWidth={1.75} />}
                onClick={() => onRequest('archive')}
              >
                أرشفة
              </Button>
            )}
            {isActive && (
              <Badge tone="success">
                <IconStamp width={12} height={12} className="me-1 inline-block" />
                نشطة
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
