/**
 * Step 13 — المجموع الكلي (NEW).
 * Per applicant-stream weighting editor. Each stream picks exam keys from
 * the academy exam catalog, assigns weights 0..100 (must sum to 100), and
 * sets a total denominator (e.g. 100 or 1000). Validation runs service-side.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useAcademyExams } from '@/features/admin/api/examPlans.queries';
import type { AdmissionCycle } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  useSetTotalScoreConfig,
  useTotalScoreConfigs,
} from '../api/admission-setup.queries';
import type { ApplicantStream, TotalScoreComponent } from '../types';

const STREAMS: { value: ApplicantStream; label: string }[] = [
  { value: 'general', label: 'تقديم عام' },
  { value: 'special', label: 'فئات خاصة' },
  { value: 'law', label: 'حقوق وقانون' },
  { value: 'sports_female', label: 'رياضات إناث' },
];

export function TotalScorePage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const { data: configs = [] } = useTotalScoreConfigs(cycle.id);
  const { data: exams = [] } = useAcademyExams();
  const [stream, setStream] = useState<ApplicantStream>('general');

  const current = configs.find((c) => c.applicantStream === stream);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="المجموع الكلي"
        subtitle="حدد وزن كل اختبار في المجموع النهائي لكل فئة من المتقدمين."
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {STREAMS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStream(s.value)}
              className={
                'rounded-md border px-3 py-1.5 text-sm transition-colors duration-fast ease-standard ' +
                (stream === s.value
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-border-default bg-surface-card text-ink-700 hover:bg-ink-50')
              }
            >
              {s.label}
              {configs.find((c) => c.applicantStream === s.value) && (
                <Badge tone="success" className="ms-2">محفوظ</Badge>
              )}
            </button>
          ))}
        </div>
      </Card>
      <StreamEditor
        key={stream}
        cycleId={cycle.id}
        stream={stream}
        canWrite={canWrite}
        initialComponents={current?.components ?? []}
        initialOutOf={current?.totalScoreOutOf ?? 100}
        examOptions={exams.map((e) => ({ value: e.key, label: e.nameAr }))}
      />
    </div>
  );
}

function StreamEditor({
  cycleId,
  stream,
  canWrite,
  initialComponents,
  initialOutOf,
  examOptions,
}: {
  cycleId: string;
  stream: ApplicantStream;
  canWrite: boolean;
  initialComponents: TotalScoreComponent[];
  initialOutOf: number;
  examOptions: { value: string; label: string }[];
}): JSX.Element {
  const [components, setComponents] = useState<TotalScoreComponent[]>(initialComponents);
  const [outOf, setOutOf] = useState<number>(initialOutOf);
  const setMut = useSetTotalScoreConfig();

  useEffect(() => {
    setComponents(initialComponents);
    setOutOf(initialOutOf);
  }, [initialComponents, initialOutOf]);

  const sum = useMemo(() => components.reduce((acc, c) => acc + c.weight, 0), [components]);

  const add = (): void => {
    setComponents((prev) => [...prev, { examKey: examOptions[0]?.value ?? '', weight: 0 }]);
  };

  const update = (i: number, patch: Partial<TotalScoreComponent>): void => {
    setComponents((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const remove = (i: number): void => {
    setComponents((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = (): void => {
    if (!canWrite) return;
    if (sum !== 100) {
      toast(`مجموع الأوزان يجب أن يكون 100 — المجموع الحالي ${sum}`, 'danger');
      return;
    }
    setMut.mutate(
      { cycleId, applicantStream: stream, components, totalScoreOutOf: outOf },
      {
        onSuccess: () => toast(`تم حفظ مكونات المجموع لـ "${stream}"`, 'success'),
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  return (
    <Card>
      <header className="mb-3 flex items-end justify-between gap-3">
        <Input
          label="المجموع الكلي من"
          type="number"
          dir="ltr"
          value={String(outOf)}
          onChange={(e) => setOutOf(Number.parseInt(e.target.value, 10) || 0)}
          disabled={!canWrite}
          containerClassName="!mb-0 w-40"
        />
        <Badge tone={sum === 100 ? 'success' : 'warning'}>
          مجموع الأوزان: <span className="font-numeric tnum">{sum}</span>
        </Badge>
      </header>

      {components.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-500">لم تتم إضافة مكونات بعد.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {components.map((c, i) => (
            <li key={i} className="grid items-end gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
              <Select
                label={i === 0 ? 'الاختبار' : undefined}
                value={c.examKey}
                onChange={(e) => update(i, { examKey: e.target.value })}
                options={examOptions}
                disabled={!canWrite}
              />
              <Input
                label={i === 0 ? 'الوزن (%)' : undefined}
                type="number"
                dir="ltr"
                value={String(c.weight)}
                onChange={(e) => update(i, { weight: Number.parseFloat(e.target.value) || 0 })}
                disabled={!canWrite}
              />
              <Input
                label={i === 0 ? 'الحد الأدنى للنجاح (اختياري)' : undefined}
                type="number"
                dir="ltr"
                value={c.minimumPassingScore !== undefined ? String(c.minimumPassingScore) : ''}
                onChange={(e) =>
                  update(i, {
                    minimumPassingScore: e.target.value ? Number.parseFloat(e.target.value) : undefined,
                  })
                }
                disabled={!canWrite}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="حذف"
                onClick={() => remove(i)}
                disabled={!canWrite}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Plus size={12} strokeWidth={1.75} />}
          onClick={add}
          disabled={!canWrite || examOptions.length === 0}
        >
          إضافة مكون
        </Button>
        <Button
          variant="primary"
          leadingIcon={<Save size={14} strokeWidth={1.75} />}
          onClick={save}
          disabled={!canWrite || sum !== 100 || components.length === 0}
          isLoading={setMut.isPending}
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
      title="يجب اختيار دورة قبول"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
