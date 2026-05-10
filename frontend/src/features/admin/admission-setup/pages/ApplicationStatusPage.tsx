/**
 * Step 3 — حالة التقديم.
 * Composes the lifecycle (activate / extend / close / archive) actions
 * extracted from CycleDetailPage. Same mutations, same audit emissions.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  EmptyState,
  Modal,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { isConflictError } from '@/shared/lib/errors';
import { LifecycleActions } from '@/features/admin/components/cycles/LifecycleActions';
import {
  useCycleActivate,
  useCycleArchive,
  useCycleClose,
  useCycleExtend,
} from '@/features/admin/api/cycles.queries';
import type { AdmissionCycle, CycleStatus } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';

const STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'مسودة',
  open: 'مفتوحة',
  active: 'نشطة',
  extended: 'ممدّدة',
  closed: 'مغلقة',
  processing: 'تحت المعالجة',
  finalized: 'مختومة',
  archived: 'مؤرشفة',
};

const STATUS_TONE: Record<CycleStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral',
  open: 'success',
  active: 'success',
  extended: 'info',
  closed: 'warning',
  processing: 'info',
  finalized: 'neutral',
  archived: 'neutral',
};

export function ApplicationStatusPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const activateMut = useCycleActivate();
  const closeMut = useCycleClose();
  const archiveMut = useCycleArchive();
  const extendMut = useCycleExtend();
  const [pendingTransition, setPendingTransition] = useState<'activate' | 'close' | 'archive' | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDate, setExtendDate] = useState<Date | null>(new Date(cycle.closeDate));

  const onConfirm = (): void => {
    const handlers = {
      onSuccess: () => toast('تم تحديث الدورة', 'success'),
      onError: (err: Error) => {
        if (isConflictError(err)) toast(err.message, 'danger');
        else toast(err.message, 'danger');
      },
    };
    if (pendingTransition === 'activate') activateMut.mutate(cycle.id, handlers);
    else if (pendingTransition === 'close') closeMut.mutate(cycle.id, handlers);
    else if (pendingTransition === 'archive') archiveMut.mutate(cycle.id, handlers);
    setPendingTransition(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            حالة التقديم
            <Badge tone={STATUS_TONE[cycle.status]}>{STATUS_LABEL[cycle.status]}</Badge>
          </span>
        }
        subtitle={`الدورة "${cycle.nameAr}" — ${fmtDate(cycle.openDate, 'short')} إلى ${fmtDate(cycle.closeDate, 'short')}`}
        actions={
          <Link to={ROUTES.admin.cycleDetail(cycle.id)} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
            >
              فتح الدورة كاملة
            </Button>
          </Link>
        }
      />

      {!canWrite && (
        <Card variant="elevated">
          <p className="text-sm text-ink-500">ليس لديك صلاحية التعديل — العرض فقط.</p>
        </Card>
      )}

      <LifecycleActions
        cycle={cycle}
        onRequest={(next) => {
          if (!canWrite) return;
          setPendingTransition(next);
        }}
        onExtend={() => {
          if (!canWrite) return;
          setExtendDate(new Date(cycle.closeDate));
          setExtendOpen(true);
        }}
      />

      <Modal
        open={pendingTransition !== null}
        onClose={() => setPendingTransition(null)}
        title={
          pendingTransition === 'activate'
            ? 'تأكيد تفعيل الدورة'
            : pendingTransition === 'close'
              ? 'تأكيد إغلاق الدورة'
              : 'تأكيد أرشفة الدورة'
        }
        size="md"
      >
        <Modal.Body>
          <p className="text-sm text-ink-700">
            {pendingTransition === 'activate' && `سيتم تفعيل دورة "${cycle.nameAr}" وإغلاق أي دورة نشطة أخرى تلقائياً.`}
            {pendingTransition === 'close' && `سيتم إغلاق دورة "${cycle.nameAr}" — لن يتمكن المتقدمون الجدد من التقديم.`}
            {pendingTransition === 'archive' && `سيتم أرشفة دورة "${cycle.nameAr}" وإخراجها من قائمة الدورات النشطة.`}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setPendingTransition(null)}>إلغاء</Button>
          <Button
            variant="primary"
            isLoading={activateMut.isPending || closeMut.isPending || archiveMut.isPending}
            onClick={onConfirm}
          >
            تأكيد
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        title="تمديد دورة القبول"
        subtitle={cycle.nameAr}
        size="md"
      >
        <Modal.Body>
          <p className="mb-3 text-sm text-ink-700">
            تاريخ الإغلاق الحالي: <span dir="ltr" className="font-mono">{fmtDate(cycle.closeDate, 'short')}</span>.
          </p>
          <DatePicker label="تاريخ الإغلاق الجديد" value={extendDate} onChange={setExtendDate} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setExtendOpen(false)}>إلغاء</Button>
          <Button
            variant="primary"
            isLoading={extendMut.isPending}
            disabled={!extendDate}
            onClick={() => {
              if (!extendDate) return;
              extendMut.mutate(
                { id: cycle.id, newCloseDate: extendDate.toISOString() },
                {
                  onSuccess: () => {
                    toast('تم تمديد الدورة', 'success');
                    setExtendOpen(false);
                  },
                  onError: (err) => toast(err.message, 'danger'),
                },
              );
            }}
          >
            تأكيد التمديد
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب إنشاء دورة قبول أولاً"
      description="لا توجد دورة لتغيير حالتها."
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
