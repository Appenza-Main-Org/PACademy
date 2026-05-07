/**
 * StationExamPage — per-station medical exam form.
 * Source: RFP Scope Document §6.2.B (eight stations, station-specific fields).
 *
 * Switches the field set by `:station` route param. Saves as preliminary
 * (two-phase pattern shared with committees/exams).
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Save, Stethoscope } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import { Gauge } from '@/shared/components/charts';
import { IconStamp } from '@/shared/components/icons';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { medicalService, STATION_LABELS, ALL_STATION_KEYS } from '../api/medical.service';
import type { MedicalStationKey, MedicalVerdict } from '@/shared/types/domain';
import { date as fmtDate, shortName } from '@/shared/lib/format';

export function StationExamPage(): JSX.Element {
  const { station: stationParam = 'eye' } = useParams<{ station: string }>();
  const station = (ALL_STATION_KEYS.includes(stationParam as MedicalStationKey)
    ? stationParam
    : 'eye') as MedicalStationKey;

  const qc = useQueryClient();
  const stationsQ = useQuery({ queryKey: ['medical', 'stations'], queryFn: () => medicalService.getStations() });
  const queueQ = useQuery({ queryKey: ['medical', 'queue', station], queryFn: () => medicalService.getQueue(`MS-0${ALL_STATION_KEYS.indexOf(station) + 1}`) });
  const resultsQ = useQuery({
    queryKey: ['medical', 'results', station],
    queryFn: () => medicalService.getResultsForStation(station),
  });

  const stationDef = stationsQ.data?.[ALL_STATION_KEYS.indexOf(station)];

  const [activeApplicantId, setActiveApplicantId] = useState<string | null>(null);
  const activeApplicant = (queueQ.data ?? []).find((a) => a.id === activeApplicantId) ?? queueQ.data?.[0] ?? null;

  /* Per-station field defaults */
  const [fields, setFields] = useState<Record<string, string | number | boolean>>(() => defaultFields(station));
  const [verdict, setVerdict] = useState<MedicalVerdict>('pass');
  const [notes, setNotes] = useState('');

  if (stationsQ.isLoading) return <CenteredShell><LoadingState variant="page" /></CenteredShell>;
  if (stationsQ.isError) return <CenteredShell><ErrorState error={stationsQ.error} onRetry={() => stationsQ.refetch()} /></CenteredShell>;

  return (
    <CenteredShell>
      <PageHeader
        title={`عيادة ${STATION_LABELS[station]}`}
        subtitle={stationDef ? `الطبيب المسؤول: ${stationDef.doctor}` : ''}
        breadcrumbs={[
          { label: 'القومسيون الطبي', href: ROUTES.medical.overview },
          { label: STATION_LABELS[station] },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {ALL_STATION_KEYS.map((s) => (
              <a
                key={s}
                href={`${ROUTES.medical.overview}/station/${s}`}
                className={
                  'rounded-pill px-3 py-1 text-2xs transition-colors duration-fast ease-standard ' +
                  (s === station ? 'text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200')
                }
                style={s === station ? { background: 'var(--accent-500)' } : undefined}
              >
                {STATION_LABELS[s]}
              </a>
            ))}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader title="طابور اليوم" subtitle={`${queueQ.data?.length ?? 0} متقدم`} />
          {queueQ.isLoading ? (
            <LoadingState variant="list" rows={6} />
          ) : !queueQ.data || queueQ.data.length === 0 ? (
            <EmptyState variant="no-applicants-yet" />
          ) : (
            <ol className="flex flex-col">
              {queueQ.data.map((a) => {
                const active = activeApplicant?.id === a.id;
                return (
                  <li
                    key={a.id}
                    className={
                      'flex cursor-pointer items-center gap-3 border-b border-border-subtle py-2 last:border-b-0 ' +
                      (active ? 'bg-teal-50' : 'hover:bg-ink-50')
                    }
                    onClick={() => setActiveApplicantId(a.id)}
                  >
                    <span className="font-numeric tnum text-2xs font-bold text-ink-500">#{a.orderNumber}</span>
                    <Avatar name={a.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{shortName(a.name, 4)}</p>
                      <p className="text-2xs text-ink-500 font-mono" dir="ltr">{a.id}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card>
          <CardHeader
            title={activeApplicant ? `إدخال نتيجة · ${shortName(activeApplicant.name, 4)}` : 'إدخال نتيجة'}
            subtitle={activeApplicant ? `الرقم القومي: ${activeApplicant.nationalId}` : 'اختر متقدماً من الطابور'}
          />
          {activeApplicant && (
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await medicalService.recordExam({
                  applicantId: activeApplicant.id,
                  applicantName: activeApplicant.name,
                  station,
                  doctor: stationDef?.doctor ?? 'د. غير محدد',
                  verdict,
                  fields,
                  notes,
                });
                toast('تم حفظ نتيجة أولية. تتطلب اعتماد رئيس القومسيون.', 'success');
                qc.invalidateQueries({ queryKey: ['medical', 'results', station] });
              }}
            >
              <StationFields station={station} fields={fields} setFields={setFields} />
              <Select
                label="الحكم النهائي"
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as MedicalVerdict)}
                options={[
                  { value: 'pass', label: 'لائق' },
                  { value: 'conditional', label: 'لائق بشرط — يحتاج مراجعة' },
                  { value: 'fail', label: 'غير لائق' },
                ]}
              />
              <Textarea label="ملاحظات الطبيب" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700 leading-normal">
                  ستُحفظ هذه النتيجة كـ <span className="font-bold">«قيد المراجعة»</span> ولن تُعتمد إلا
                  بتوقيع رئيس القومسيون.
                </div>
                <Button type="submit" variant="primary" size="lg" leadingIcon={<Save size={14} strokeWidth={1.75} />}>
                  حفظ كنتيجة أولية
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      {resultsQ.data && resultsQ.data.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="نتائج اليوم"
            subtitle={`${resultsQ.data.length} نتيجة عبر ${STATION_LABELS[station]}`}
            actions={<Badge tone="info"><Activity size={11} strokeWidth={1.75} className="me-1 inline-block" /> {STATION_LABELS[station]}</Badge>}
          />
          <ol className="flex flex-col">
            {resultsQ.data.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border-subtle py-2 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-ink-900">{shortName(r.applicantName, 3)}</p>
                  <p className="text-2xs text-ink-500">{r.doctor} · {fmtDate(r.enteredAt, 'rel')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={r.verdict === 'pass' ? 'success' : r.verdict === 'fail' ? 'danger' : 'warning'}>
                    {r.verdict === 'pass' ? 'لائق' : r.verdict === 'fail' ? 'غير لائق' : 'بشرط'}
                  </Badge>
                  <Badge tone={r.phase === 'final' ? 'success' : 'warning'}>
                    {r.phase === 'final' && <IconStamp width={12} height={12} className="me-1 inline-block" />}
                    {r.phase === 'final' ? 'معتمد' : 'قيد المراجعة'}
                  </Badge>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </CenteredShell>
  );
}

function StationFields({
  station,
  fields,
  setFields,
}: {
  station: MedicalStationKey;
  fields: Record<string, string | number | boolean>;
  setFields: (f: Record<string, string | number | boolean>) => void;
}): JSX.Element {
  const set = (k: string, v: string | number | boolean): void => setFields({ ...fields, [k]: v });
  const acuity = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'];

  if (station === 'eye') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="حدّة العين اليمنى (بدون نظارة)" value={String(fields.acuityRight ?? '6/9')} onChange={(e) => set('acuityRight', e.target.value)} options={acuity.map((v) => ({ value: v, label: v }))} />
        <Select label="حدّة العين اليسرى (بدون نظارة)" value={String(fields.acuityLeft ?? '6/9')} onChange={(e) => set('acuityLeft', e.target.value)} options={acuity.map((v) => ({ value: v, label: v }))} />
        <Input label="ضغط العين اليمنى (mmHg)" type="number" value={Number(fields.pressureRight ?? 14)} onChange={(e) => set('pressureRight', Number(e.target.value))} />
        <Input label="ضغط العين اليسرى (mmHg)" type="number" value={Number(fields.pressureLeft ?? 14)} onChange={(e) => set('pressureLeft', Number(e.target.value))} />
        <Select label="رؤية الألوان" value={String(fields.colorVision ?? 'normal')} onChange={(e) => set('colorVision', e.target.value)} options={[{ value: 'normal', label: 'طبيعي' }, { value: 'abnormal', label: 'مضطرب' }]} />
        <Select label="مجال الإبصار" value={String(fields.fieldOfVision ?? 'normal')} onChange={(e) => set('fieldOfVision', e.target.value)} options={[{ value: 'normal', label: 'طبيعي' }, { value: 'restricted', label: 'مقيّد' }]} />
      </div>
    );
  }
  if (station === 'ent') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="السمع — اليمنى (dB)" type="number" value={Number(fields.hearingRight ?? 25)} onChange={(e) => set('hearingRight', Number(e.target.value))} />
        <Input label="السمع — اليسرى (dB)" type="number" value={Number(fields.hearingLeft ?? 25)} onChange={(e) => set('hearingLeft', Number(e.target.value))} />
        <Select label="طبلة الأذن" value={String(fields.tympanic ?? 'normal')} onChange={(e) => set('tympanic', e.target.value)} options={[{ value: 'normal', label: 'سليمة' }, { value: 'perforated', label: 'مثقوبة' }, { value: 'scarred', label: 'متندبة' }]} />
        <Input label="ملاحظات الجيوب الأنفية" value={String(fields.sinus ?? '')} onChange={(e) => set('sinus', e.target.value)} />
        <Input label="الحبال الصوتية" value={String(fields.vocalCords ?? '')} onChange={(e) => set('vocalCords', e.target.value)} containerClassName="md:col-span-2" />
      </div>
    );
  }
  if (station === 'internal') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="ضغط الدم" placeholder="120/80" value={String(fields.bloodPressure ?? '120/80')} onChange={(e) => set('bloodPressure', e.target.value)} />
        <Input label="نبض القلب" type="number" value={Number(fields.heartRate ?? 72)} onChange={(e) => set('heartRate', Number(e.target.value))} />
        <Input label="معدل التنفس" type="number" value={Number(fields.respRate ?? 16)} onChange={(e) => set('respRate', Number(e.target.value))} />
        <Input label="درجة الحرارة (°C)" type="number" step="0.1" value={Number(fields.temp ?? 36.7)} onChange={(e) => set('temp', Number(e.target.value))} />
      </div>
    );
  }
  if (station === 'orthopedic') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="استقامة العمود الفقري" value={String(fields.spine ?? 'normal')} onChange={(e) => set('spine', e.target.value)} options={[{ value: 'normal', label: 'طبيعية' }, { value: 'scoliosis', label: 'انحراف جانبي' }, { value: 'kyphosis', label: 'حدب' }, { value: 'lordosis', label: 'تقوّس قطني' }]} />
        <Select label="نوع القدم" value={String(fields.footType ?? 'normal')} onChange={(e) => set('footType', e.target.value)} options={[{ value: 'normal', label: 'طبيعية' }, { value: 'flat', label: 'مسطحة' }, { value: 'cavus', label: 'مقوّسة' }]} />
        <Select label="مرونة المفاصل" value={String(fields.flexibility ?? 'good')} onChange={(e) => set('flexibility', e.target.value)} options={[{ value: 'good', label: 'جيدة' }, { value: 'limited', label: 'محدودة' }]} />
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={Boolean(fields.previousFractures ?? false)} onChange={(e) => set('previousFractures', e.target.checked)} className="h-4 w-4 cursor-pointer accent-teal-500" />
          كسور سابقة
        </label>
      </div>
    );
  }
  if (station === 'neuro') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="الانعكاسات" value={String(fields.reflexes ?? 'normal')} onChange={(e) => set('reflexes', e.target.value)} options={[{ value: 'normal', label: 'طبيعية' }, { value: 'reduced', label: 'منخفضة' }, { value: 'exaggerated', label: 'مفرطة' }]} />
        <Select label="التناسق الحركي" value={String(fields.coordination ?? 'normal')} onChange={(e) => set('coordination', e.target.value)} options={[{ value: 'normal', label: 'طبيعي' }, { value: 'impaired', label: 'متأثر' }]} />
        <Select label="الأعصاب القحفية" value={String(fields.cranialNerves ?? 'normal')} onChange={(e) => set('cranialNerves', e.target.value)} options={[{ value: 'normal', label: 'طبيعية' }, { value: 'abnormal', label: 'غير طبيعية' }]} />
        <Select label="الإدراك المعرفي" value={String(fields.cognitive ?? 'normal')} onChange={(e) => set('cognitive', e.target.value)} options={[{ value: 'normal', label: 'طبيعي' }, { value: 'impaired', label: 'متأثر' }]} />
      </div>
    );
  }
  if (station === 'psychology') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="التعامل مع الضغط" value={String(fields.stressResponse ?? 'good')} onChange={(e) => set('stressResponse', e.target.value)} options={[{ value: 'good', label: 'جيد' }, { value: 'average', label: 'متوسط' }, { value: 'poor', label: 'ضعيف' }]} />
        <Input label="مؤشر الشخصية (0-100)" type="number" value={Number(fields.personalityScore ?? 78)} onChange={(e) => set('personalityScore', Number(e.target.value))} />
        <Textarea label="ملاحظات المقابلة" containerClassName="md:col-span-2" value={String(fields.interviewNotes ?? '')} onChange={(e) => set('interviewNotes', e.target.value)} />
      </div>
    );
  }
  if (station === 'surgery') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={Boolean(fields.hernias ?? false)} onChange={(e) => set('hernias', e.target.checked)} className="h-4 w-4 cursor-pointer accent-teal-500" />
          فتق
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={Boolean(fields.varicose ?? false)} onChange={(e) => set('varicose', e.target.checked)} className="h-4 w-4 cursor-pointer accent-teal-500" />
          دوالي
        </label>
        <Input label="مكان الفتق إن وُجد" value={String(fields.herniaLocation ?? '')} onChange={(e) => set('herniaLocation', e.target.value)} />
        <Input label="الندوب الجراحية" value={String(fields.scars ?? '')} onChange={(e) => set('scars', e.target.value)} />
      </div>
    );
  }
  /* bmi */
  const heightCm = Number(fields.heightCm ?? 178);
  const weightKg = Number(fields.weightKg ?? 73);
  const chestInhale = Number(fields.chestInhale ?? 92);
  const chestExhale = Number(fields.chestExhale ?? 86);
  const bmi = +(weightKg / Math.pow(heightCm / 100, 2)).toFixed(1);
  const expansion = +(chestInhale - chestExhale).toFixed(1);

  const heightOk = heightCm >= 170 && heightCm <= 195;
  const weightOk = weightKg >= 60 && weightKg <= 95;
  const bmiCategory =
    bmi < 18.5 ? { label: 'نقص وزن', tone: 'warning' as const, ok: false }
    : bmi < 25  ? { label: 'مثالي', tone: 'success' as const, ok: true }
    : bmi < 30  ? { label: 'زيادة طفيفة', tone: 'warning' as const, ok: true }
    :             { label: 'سُمنة', tone: 'danger' as const, ok: false };
  const expansionOk = expansion >= 5;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="الطول (سم)"
          type="number"
          value={heightCm}
          onChange={(e) => set('heightCm', Number(e.target.value))}
          helper={heightOk ? 'ضمن المعدل المطلوب 170-195' : 'خارج النطاق المطلوب §6.2.B'}
        />
        <Input
          label="الوزن (كجم)"
          type="number"
          value={weightKg}
          onChange={(e) => set('weightKg', Number(e.target.value))}
          helper={weightOk ? 'ضمن النطاق المعتاد' : 'يحتاج مراجعة'}
        />
        <Input label="محيط الصدر — شهيق (سم)" type="number" value={chestInhale} onChange={(e) => set('chestInhale', Number(e.target.value))} />
        <Input label="محيط الصدر — زفير (سم)" type="number" value={chestExhale} onChange={(e) => set('chestExhale', Number(e.target.value))} />
      </div>

      {/* Live verdict panel */}
      <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-ink-50 p-4">
        <header className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-2xs font-bold uppercase tracking-wide text-teal-700">
            <Stethoscope size={12} strokeWidth={1.75} aria-hidden />
            معاينة فورية
          </span>
          <Badge tone={bmiCategory.tone}>{bmiCategory.label}</Badge>
        </header>

        <div className="flex justify-center">
          <Gauge value={bmi} min={15} max={40} label="BMI" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-2xs">
          <div className="rounded-md border border-border-subtle bg-surface-card p-2 text-center">
            <p className="text-ink-500">معدل BMI</p>
            <p className={'mt-0.5 font-mono text-md font-bold tnum ' + (bmiCategory.ok ? 'text-success' : 'text-terra-600')} dir="ltr">{bmi}</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-card p-2 text-center">
            <p className="text-ink-500">سعة الصدر</p>
            <p className={'mt-0.5 font-mono text-md font-bold tnum ' + (expansionOk ? 'text-success' : 'text-terra-600')} dir="ltr">+{expansion} سم</p>
          </div>
        </div>

        <ul className="border-t border-border-subtle pt-2 text-2xs text-ink-700">
          <li className="flex items-center justify-between gap-2">
            <span>BMI ضمن النطاق المثالي 18.5-25</span>
            <span className={bmiCategory.ok ? 'text-success' : 'text-terra-600'}>{bmiCategory.ok ? '✓' : '✗'}</span>
          </li>
          <li className="mt-1 flex items-center justify-between gap-2">
            <span>سعة الصدر ≥ 5 سم</span>
            <span className={expansionOk ? 'text-success' : 'text-terra-600'}>{expansionOk ? '✓' : '✗'}</span>
          </li>
          <li className="mt-1 flex items-center justify-between gap-2">
            <span>الطول ضمن المعدل 170-195</span>
            <span className={heightOk ? 'text-success' : 'text-terra-600'}>{heightOk ? '✓' : '✗'}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function defaultFields(_s: MedicalStationKey): Record<string, string | number | boolean> {
  return {};
}
