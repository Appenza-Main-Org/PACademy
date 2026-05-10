/**
 * Step 1 — بيانات سنة التقديم.
 * Composes the cycle name / year / cohort / dates inline form over the
 * same `useCycleUpdate` mutation that backs `CycleDetailPage`. No fork.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import {
  Button,
  Card,
  DatePicker,
  EmptyState,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import type { AdmissionCycle } from '@/shared/types/domain';
import { useCycleUpdate } from '@/features/admin/api/cycles.queries';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';

export function CycleMetadataPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Form cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Form({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const updateMut = useCycleUpdate();
  const readOnly = !canWrite || cycle.status === 'archived' || cycle.status === 'finalized';

  const [nameAr, setNameAr] = useState(cycle.nameAr);
  const [year, setYear] = useState<number>(cycle.year);
  const [cohort, setCohort] = useState<AdmissionCycle['cohort']>(cycle.cohort);
  const [openDate, setOpenDate] = useState<Date | null>(new Date(cycle.openDate));
  const [closeDate, setCloseDate] = useState<Date | null>(new Date(cycle.closeDate));
  const [ageCalcDate, setAgeCalcDate] = useState<Date | null>(
    cycle.ageCalcDate ? new Date(cycle.ageCalcDate) : null,
  );

  /* Re-seed on cycle switch so the form mirrors the picked cycle. */
  useEffect(() => {
    setNameAr(cycle.nameAr);
    setYear(cycle.year);
    setCohort(cycle.cohort);
    setOpenDate(new Date(cycle.openDate));
    setCloseDate(new Date(cycle.closeDate));
    setAgeCalcDate(cycle.ageCalcDate ? new Date(cycle.ageCalcDate) : null);
  }, [cycle]);

  const dirty =
    nameAr !== cycle.nameAr ||
    year !== cycle.year ||
    cohort !== cycle.cohort ||
    (openDate?.toISOString() ?? '') !== cycle.openDate ||
    (closeDate?.toISOString() ?? '') !== cycle.closeDate ||
    (ageCalcDate?.toISOString() ?? '') !== (cycle.ageCalcDate ?? '');

  const save = (): void => {
    if (readOnly || !openDate || !closeDate) return;
    if (closeDate.getTime() <= openDate.getTime()) {
      toast('تاريخ الإغلاق يجب أن يكون بعد تاريخ الفتح', 'danger');
      return;
    }
    updateMut.mutate(
      {
        id: cycle.id,
        patch: {
          nameAr: nameAr.trim(),
          year,
          cohort,
          openDate: openDate.toISOString(),
          closeDate: closeDate.toISOString(),
          ageCalcDate: ageCalcDate ? ageCalcDate.toISOString() : undefined,
        },
      },
      {
        onSuccess: () => toast('تم حفظ بيانات الدورة', 'success'),
        onError: (err) => toast((err as Error).message ?? 'تعذر الحفظ', 'danger'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="بيانات سنة التقديم"
        subtitle={`آخر تحديث: ${fmtDate(cycle.updatedAt, 'short')}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to={ROUTES.admin.cycleDetail(cycle.id)} className="inline-flex">
              <Button
                variant="ghost"
                size="sm"
                trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
              >
                فتح الدورة كاملة
              </Button>
            </Link>
            <Button
              variant="primary"
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              onClick={save}
              disabled={readOnly || !dirty}
              isLoading={updateMut.isPending}
            >
              حفظ
            </Button>
          </div>
        }
      />
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="اسم الدورة"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            disabled={readOnly}
          />
          <Input
            label="السنة"
            type="number"
            dir="ltr"
            value={String(year)}
            onChange={(e) => setYear(Number.parseInt(e.target.value, 10) || cycle.year)}
            disabled={readOnly}
          />
          <Select
            label="الفئة"
            value={cohort}
            onChange={(e) => setCohort(e.target.value as AdmissionCycle['cohort'])}
            options={[
              { value: 'male', label: 'ذكور' },
              { value: 'female', label: 'إناث' },
            ]}
            disabled={readOnly}
          />
          <div />
          <DatePicker label="تاريخ الفتح" value={openDate} onChange={setOpenDate} disabled={readOnly} />
          <DatePicker label="تاريخ الإغلاق" value={closeDate} onChange={setCloseDate} disabled={readOnly} />
          <DatePicker
            label="تاريخ احتساب السن"
            value={ageCalcDate}
            onChange={setAgeCalcDate}
            disabled={readOnly}
          />
        </div>
        {readOnly && (
          <p className="mt-3 text-2xs text-ink-500">
            ليس لديك صلاحية التعديل أو أن هذه الدورة مغلقة/مؤرشفة.
          </p>
        )}
      </Card>
    </div>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب إنشاء دورة قبول أولاً"
      description="لا توجد دورة قبول مفعّلة لتعديل بياناتها."
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
