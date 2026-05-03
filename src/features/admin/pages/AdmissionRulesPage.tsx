/**
 * AdmissionRulesPage — versioned editor for شروط التقدم.
 * Source: Tasks/KARASA_GAPS.md §1.2.C.
 *
 * Saves create a NEW version of the rule for the selected cycle. Earlier
 * versions stay readable in the version history panel; the current rule
 * is what the cycle enforces today.
 */

import { useEffect, useMemo, useState } from 'react';
import { History, Save } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { useCycles } from '../api/cycles.queries';
import { useCurrentRule, useRulesForCycle, useSaveRule } from '../api/admissionRules.queries';
import type { AdmissionRule } from '@/shared/types/domain';

const MARITAL_OPTIONS: ReadonlyArray<{ value: AdmissionRule['maritalStatus'][number]; label: string }> = [
  { value: 'single', label: 'أعزب' },
  { value: 'married', label: 'متزوج' },
  { value: 'divorced', label: 'مطلق' },
  { value: 'widowed', label: 'أرمل' },
];

export function AdmissionRulesPage(): JSX.Element {
  const { data: cycles, isLoading: cyclesLoading } = useCycles();
  const [cycleId, setCycleId] = useState<string>('');

  /* default to first non-finalized cycle */
  useEffect(() => {
    if (!cycleId && cycles?.length) {
      const candidate = cycles.find((c) => c.status !== 'finalized') ?? cycles[0];
      if (candidate) setCycleId(candidate.id);
    }
  }, [cycles, cycleId]);

  const { data: current, isLoading: ruleLoading, error, refetch } = useCurrentRule(cycleId || null);
  const { data: history } = useRulesForCycle(cycleId || null);
  const saveMut = useSaveRule();

  const [draft, setDraft] = useState<AdmissionRule | null>(null);
  useEffect(() => {
    if (current) setDraft({ ...current });
  }, [current]);

  const cycleOptions = useMemo(
    () => (cycles ?? []).map((c) => ({ value: c.id, label: c.nameAr })),
    [cycles],
  );

  if (cyclesLoading) return <CenteredShell><LoadingState variant="page" /></CenteredShell>;

  return (
    <CenteredShell>
      <PageHeader
        title="شروط القبول"
        subtitle="تحديد ومراجعة شروط التقدم لكل دورة. كل تعديل يُحفظ كنسخة جديدة موسومة بالمسؤول والتاريخ."
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'شروط القبول' },
        ]}
        actions={
          <Select
            aria-label="اختر الدورة"
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            options={cycleOptions}
          />
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : ruleLoading || !draft ? (
        <LoadingState variant="detail" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader title="إعدادات شروط القبول" subtitle={`الدورة: ${draft.cycleId}`} />
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                saveMut.mutate(
                  {
                    cycleId: draft.cycleId,
                    age: draft.age,
                    height: draft.height,
                    bmi: draft.bmi,
                    eyesight: draft.eyesight,
                    maritalStatus: draft.maritalStatus,
                    noCriminalRecord: draft.noCriminalRecord,
                    acceptedCertificates: draft.acceptedCertificates,
                    minPercentByCertType: draft.minPercentByCertType,
                    applicationFee: draft.applicationFee,
                    maxApplicationsPerYear: draft.maxApplicationsPerYear,
                    changedBy: { userId: 'U-001', name: 'العميد د. أحمد محمود الفقي' },
                  },
                  {
                    onSuccess: () => toast('تم حفظ نسخة جديدة من الشروط', 'success'),
                    onError: (err) => toast(err.message ?? 'تعذر الحفظ', 'danger'),
                  },
                );
              }}
            >
              <Section title="السن">
                <Input
                  label="الحد الأدنى (سنوات)"
                  type="number"
                  value={draft.age.minYears}
                  onChange={(e) =>
                    setDraft({ ...draft, age: { ...draft.age, minYears: Number(e.target.value) } })
                  }
                />
                <Input
                  label="الحد الأقصى (سنوات)"
                  type="number"
                  value={draft.age.maxYears}
                  onChange={(e) =>
                    setDraft({ ...draft, age: { ...draft.age, maxYears: Number(e.target.value) } })
                  }
                />
              </Section>

              <Section title="الطول (سم)">
                <Input
                  label="ذكور · أدنى"
                  type="number"
                  value={draft.height.male.min}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      height: { ...draft.height, male: { ...draft.height.male, min: Number(e.target.value) } },
                    })
                  }
                />
                <Input
                  label="ذكور · أقصى"
                  type="number"
                  value={draft.height.male.max}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      height: { ...draft.height, male: { ...draft.height.male, max: Number(e.target.value) } },
                    })
                  }
                />
                <Input
                  label="إناث · أدنى"
                  type="number"
                  value={draft.height.female.min}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      height: { ...draft.height, female: { ...draft.height.female, min: Number(e.target.value) } },
                    })
                  }
                />
                <Input
                  label="إناث · أقصى"
                  type="number"
                  value={draft.height.female.max}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      height: { ...draft.height, female: { ...draft.height.female, max: Number(e.target.value) } },
                    })
                  }
                />
              </Section>

              <Section title="مؤشر كتلة الجسم (BMI)">
                <Input
                  label="أدنى"
                  type="number"
                  value={draft.bmi.min}
                  onChange={(e) =>
                    setDraft({ ...draft, bmi: { ...draft.bmi, min: Number(e.target.value) } })
                  }
                />
                <Input
                  label="أقصى"
                  type="number"
                  value={draft.bmi.max}
                  onChange={(e) =>
                    setDraft({ ...draft, bmi: { ...draft.bmi, max: Number(e.target.value) } })
                  }
                />
              </Section>

              <Section title="الإبصار">
                <Input
                  label="حدّة العين اليمنى"
                  value={draft.eyesight.minRightEye}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      eyesight: { ...draft.eyesight, minRightEye: e.target.value },
                    })
                  }
                />
                <Input
                  label="حدّة العين اليسرى"
                  value={draft.eyesight.minLeftEye}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      eyesight: { ...draft.eyesight, minLeftEye: e.target.value },
                    })
                  }
                />
                <label className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-sm">
                  <span className="text-ink-700">السماح بالنظارة الطبية</span>
                  <input
                    type="checkbox"
                    checked={draft.eyesight.correctionAllowed}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        eyesight: { ...draft.eyesight, correctionAllowed: e.target.checked },
                      })
                    }
                    className="h-4 w-4 cursor-pointer accent-teal-500"
                  />
                </label>
              </Section>

              <Section title="الحالة الاجتماعية">
                <div className="flex flex-wrap gap-2">
                  {MARITAL_OPTIONS.map((opt) => {
                    const active = draft.maritalStatus.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const set = new Set(draft.maritalStatus);
                          if (active) set.delete(opt.value);
                          else set.add(opt.value);
                          setDraft({ ...draft, maritalStatus: Array.from(set) });
                        }}
                        className={
                          'rounded-pill border px-3 py-1 text-xs transition-colors duration-fast ease-standard ' +
                          (active
                            ? ''
                            : 'border-border-default text-ink-700 hover:bg-ink-50')
                        }
                        style={active ? { borderColor: 'var(--accent-500)', background: 'var(--accent-50)', color: 'var(--accent-700)' } : undefined}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section title="السجل الجنائي والقضائي">
                <label className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-sm">
                  <span className="text-ink-700">يلزم خلو السجل الجنائي</span>
                  <input
                    type="checkbox"
                    checked={draft.noCriminalRecord}
                    onChange={(e) => setDraft({ ...draft, noCriminalRecord: e.target.checked })}
                    className="h-4 w-4 cursor-pointer accent-teal-500"
                  />
                </label>
              </Section>

              <Section title="الإعدادات العامة">
                <Input
                  label="الحد الأقصى لطلبات المتقدم سنوياً"
                  type="number"
                  value={draft.maxApplicationsPerYear}
                  onChange={(e) =>
                    setDraft({ ...draft, maxApplicationsPerYear: Number(e.target.value) })
                  }
                />
              </Section>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={saveMut.isPending}
                  leadingIcon={<Save size={14} strokeWidth={1.75} />}
                >
                  حفظ نسخة جديدة
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="سجل النسخ" subtitle={`عدد الإصدارات: ${history?.length ?? 0}`} />
            <ul className="flex flex-col">
              {(history ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      <History size={12} strokeWidth={1.75} className="me-1 inline-block" /> الإصدار{' '}
                      <span className="font-numeric tnum" dir="ltr">{r.version}</span>
                    </p>
                    <p className="text-xs text-ink-500">{r.changedBy.name}</p>
                    <p className="text-2xs text-ink-400">{fmtDate(r.effectiveAt)}</p>
                  </div>
                  {r.id === current?.id && <Badge tone="success">الحالي</Badge>}
                </li>
              ))}
              {(history ?? []).length === 0 && (
                <li className="py-6 text-center text-sm text-ink-500">لا توجد نسخ بعد</li>
              )}
            </ul>
          </Card>
        </div>
      )}
    </CenteredShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <fieldset className="rounded-md border border-border-subtle bg-ink-50/60 p-4">
      <legend className="px-2 text-2xs font-medium uppercase tracking-wide text-ink-500">{title}</legend>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}
