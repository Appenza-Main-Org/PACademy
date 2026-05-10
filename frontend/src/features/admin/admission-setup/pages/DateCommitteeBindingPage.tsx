/**
 * Step 12 — ربط المواعيد باللجان.
 * Per-committee `availableDates` + `capacityPerDay` editor that hits the
 * same `useCommitteeUpdate` mutation Gap H ships. Re-uses the cycle's
 * `examDateConfig.bookableDays` (Step 11) as the pool of valid dates if
 * present, otherwise lets the admin pick freely.
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
import { useCommittees, useCommitteeUpdate } from '@/features/committees';
import type { AdmissionCycle, Committee } from '@/shared/types/domain';
import { date as fmtDate } from '@/shared/lib/format';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { useExamDateConfig } from '../api/admission-setup.queries';

export function DateCommitteeBindingPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const { data: committees = [] } = useCommittees();
  const { data: examDateConfig } = useExamDateConfig(cycle.id);
  const cycleCommittees = committees.filter(
    (c) => !c.linkedCycleId || c.linkedCycleId === cycle.id,
  );

  const allowedDates = (examDateConfig?.bookableDays ?? []).filter(
    (d) => !(examDateConfig?.blackoutDates ?? []).includes(d),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="ربط المواعيد باللجان"
        subtitle={
          allowedDates.length > 0
            ? `${allowedDates.length} يوم متاح للحجز من خطوة مواعيد الاختبارات.`
            : 'لم يتم ضبط مواعيد الاختبارات بعد — يمكنك ضبط الأيام والسعة لكل لجنة، وستُحقق عند ربطها بالمواعيد لاحقاً.'
        }
        actions={
          <Link to={ROUTES.admin.admissionSetup.examDates} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
            >
              مواعيد الاختبارات
            </Button>
          </Link>
        }
      />

      {cycleCommittees.length === 0 ? (
        <EmptyState
          variant="generic"
          title="لا توجد لجان مرتبطة بهذه الدورة"
          action={
            <Link to={ROUTES.admin.admissionSetup.committees} className="inline-flex">
              <Button variant="primary">إدارة اللجان</Button>
            </Link>
          }
        />
      ) : (
        cycleCommittees.map((c) => (
          <CommitteeBindingCard
            key={c.id}
            committee={c}
            allowedDates={allowedDates}
            canWrite={canWrite}
          />
        ))
      )}
    </div>
  );
}

function CommitteeBindingCard({
  committee,
  allowedDates,
  canWrite,
}: {
  committee: Committee;
  allowedDates: string[];
  canWrite: boolean;
}): JSX.Element {
  const updateMut = useCommitteeUpdate();
  const [dates, setDates] = useState<string[]>(committee.availableDates ?? []);
  const [capacity, setCapacity] = useState<number>(committee.capacityPerDay ?? 0);

  useEffect(() => {
    setDates(committee.availableDates ?? []);
    setCapacity(committee.capacityPerDay ?? 0);
  }, [committee]);

  const dirty =
    JSON.stringify([...dates].sort()) !==
      JSON.stringify([...(committee.availableDates ?? [])].sort()) ||
    capacity !== (committee.capacityPerDay ?? 0);

  const toggleDate = (d: string): void => {
    setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const save = (): void => {
    if (!canWrite) return;
    if (capacity < 0) {
      toast('السعة اليومية لا يمكن أن تكون سالبة', 'danger');
      return;
    }
    updateMut.mutate(
      {
        id: committee.id,
        patch: {
          availableDates: [...dates].sort(),
          capacityPerDay: capacity,
          linkedCycleId: committee.linkedCycleId,
        },
      },
      {
        onSuccess: () => toast(`تم حفظ مواعيد لجنة "${committee.name}"`, 'success'),
        onError: (err) => toast((err).message ?? 'تعذر الحفظ', 'danger'),
      },
    );
  };

  return (
    <Card>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-ar-display text-md font-bold text-ink-900">{committee.name}</h3>
          <p className="mt-0.5 text-2xs text-ink-500">رئيس اللجنة: {committee.head}</p>
        </div>
        <Input
          label="السعة اليومية"
          type="number"
          dir="ltr"
          value={String(capacity)}
          onChange={(e) => setCapacity(Number.parseInt(e.target.value, 10) || 0)}
          disabled={!canWrite}
          containerClassName="!mb-0 w-32"
        />
      </header>

      {allowedDates.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {allowedDates.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={dates.includes(d)}
                onChange={() => toggleDate(d)}
                disabled={!canWrite}
                className="h-4 w-4 cursor-pointer accent-teal-500"
              />
              <span dir="ltr" className="font-mono">{fmtDate(d, 'short')}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-2xs text-ink-500">
          {dates.length === 0
            ? 'لا توجد أيام مرتبطة بهذه اللجنة بعد.'
            : `${dates.length} يوم محفوظ للجنة (لم يتم ضبط مواعيد عامة بعد).`}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          leadingIcon={<Save size={14} strokeWidth={1.75} />}
          onClick={save}
          disabled={!canWrite || !dirty}
          isLoading={updateMut.isPending}
        >
          حفظ
        </Button>
      </div>
    </Card>
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
