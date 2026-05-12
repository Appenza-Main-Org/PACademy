/**
 * Step 10 — درجات القبول (NEW).
 * Per-committee min/max accepted-score editor. Validation: min < max,
 * non-negative. Backed by `setCommitteeScoreThresholds`, which writes to
 * `Committee.scoreCriteria.magmoo3` (the existing Gap H field) so the
 * threshold is consumed everywhere it's already wired.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useCommittees } from '@/features/committees';
import type { AdmissionCycle, Committee } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { useSetCommitteeScoreThresholds } from '../api/admission-setup.queries';

export function ScoreThresholdsPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const { data: committees = [] } = useCommittees({ cycleId: cycle.id });
  const cycleCommittees = committees;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="درجات القبول"
        subtitle="حدد الحد الأدنى والأقصى المقبول من المجموع لكل لجنة."
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
          <ThresholdCard key={c.id} committee={c} cycleId={cycle.id} canWrite={canWrite} />
        ))
      )}
    </div>
  );
}

function ThresholdCard({
  committee,
  cycleId,
  canWrite,
}: {
  committee: Committee;
  cycleId: string;
  canWrite: boolean;
}): JSX.Element {
  const initial = committee.scoreCriteria?.magmoo3;
  const [min, setMin] = useState<number>(initial?.min ?? 0);
  const [max, setMax] = useState<number>(initial?.max ?? 0);
  const setMut = useSetCommitteeScoreThresholds();

  useEffect(() => {
    setMin(initial?.min ?? 0);
    setMax(initial?.max ?? 0);
  }, [initial]);

  const dirty = min !== (initial?.min ?? 0) || max !== (initial?.max ?? 0);

  const save = (): void => {
    if (!canWrite) return;
    setMut.mutate(
      { cycleId, committeeId: committee.id, min, max },
      {
        onSuccess: () => toast(`تم حفظ درجات القبول للجنة "${committee.name}"`, 'success'),
        onError: (err) => toast((err).message, 'danger'),
      },
    );
  };

  return (
    <Card>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-ar-display text-md font-bold text-ink-900">{committee.name}</h3>
          <p className="mt-0.5 text-2xs text-ink-500">{committee.head}</p>
        </div>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          label="الحد الأدنى"
          type="number"
          dir="ltr"
          value={String(min)}
          onChange={(e) => setMin(Number.parseFloat(e.target.value) || 0)}
          disabled={!canWrite}
        />
        <Input
          label="الحد الأقصى"
          type="number"
          dir="ltr"
          value={String(max)}
          onChange={(e) => setMax(Number.parseFloat(e.target.value) || 0)}
          disabled={!canWrite}
        />
        <div className="self-end">
          <Button
            variant="primary"
            leadingIcon={<Save size={14} strokeWidth={1.75} />}
            onClick={save}
            disabled={!canWrite || !dirty}
            isLoading={setMut.isPending}
          >
            حفظ
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب اختيار دورة قبول"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
