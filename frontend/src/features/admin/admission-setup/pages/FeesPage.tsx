/**
 * Step 6 — الرسوم المالية.
 * Application fee input. Same `useCycleUpdate` mutation as CycleDetailPage; no fork.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useCycleUpdate } from '@/features/admin/api/cycles.queries';
import type { AdmissionCycle, CycleFees } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';

const DEFAULT_APPLICATION_FEE = 250;

export function FeesPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const updateMut = useCycleUpdate();
  const readOnly = !canWrite || cycle.status === 'archived' || cycle.status === 'finalized';
  const fees = cycle.fees;

  const [applicationFee, setApplicationFee] = useState<number>(fees?.applicationFee ?? DEFAULT_APPLICATION_FEE);

  useEffect(() => {
    setApplicationFee(fees?.applicationFee ?? DEFAULT_APPLICATION_FEE);
  }, [fees]);

  const dirty = applicationFee !== (fees?.applicationFee ?? DEFAULT_APPLICATION_FEE);

  const save = (): void => {
    if (readOnly || applicationFee <= 0) {
      if (applicationFee <= 0) toast('رسوم التقديم يجب أن تكون أكبر من صفر', 'danger');
      return;
    }
    const next: CycleFees = {
      applicationFee,
      fawryConfig: fees?.fawryConfig,
    };
    updateMut.mutate(
      { id: cycle.id, patch: { fees: next } },
      {
        onSuccess: () => toast('تم حفظ الرسوم', 'success'),
        onError: (err) => toast((err as Error).message ?? 'تعذر الحفظ', 'danger'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="الرسوم المالية"
        subtitle="رسوم التقديم لهذه الدورة."
        actions={
          <Link to={ROUTES.admin.payments} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
            >
              سجل المدفوعات
            </Button>
          </Link>
        }
      />

      <Card>
        <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">رسوم الدورة</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="رسوم التقديم (ج.م)"
            type="number"
            dir="ltr"
            value={String(applicationFee)}
            onChange={(e) => setApplicationFee(Number.parseFloat(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            leadingIcon={<Save size={14} strokeWidth={1.75} />}
            onClick={save}
            disabled={readOnly || !dirty}
            isLoading={updateMut.isPending}
          >
            حفظ الرسوم
          </Button>
        </div>
      </Card>
    </div>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب إنشاء دورة قبول أولاً"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
