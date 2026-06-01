/**
 * ApplicantControlScreensSettingsCard — applicant control-screen visibility
 * gates section of /admin/settings. Determines which admission test opens and
 * closes the acquaintance document, including optional relative durations.
 *
 * Presentational + controlled: form state, validation, and persistence live in
 * the parent SettingsPage so the whole page saves with one button.
 *
 * Usage:
 *   <ApplicantControlScreensSettingsCard
 *     form={control}
 *     testOptions={testOptions}
 *     hasTests={hasTests}
 *     showErrors={touched}
 *     onChange={(key, value) => setControl((c) => ({ ...c, [key]: value }))}
 *   />
 */

import { Settings2 } from 'lucide-react';
import { Card, CardBody, CardHeader, Input, Select, Textarea } from '@/shared/components';
import type { AdminSettings } from '../../api/settings.service';

export type DocumentTiming = NonNullable<AdminSettings['acquaintanceDocumentsOpenTiming']>;
export type DurationUnit = NonNullable<AdminSettings['acquaintanceDocumentsOpenOffsetUnit']>;

export const DEFAULT_DOCUMENT_TIMING: DocumentTiming = 'on_test_time';
export const DEFAULT_DURATION_UNIT: DurationUnit = 'days';

const DOCUMENT_TIMING_OPTIONS: Array<{ value: DocumentTiming; label: string }> = [
  { value: 'before_test', label: 'قبل موعد الاختبار' },
  { value: 'after_test_passed', label: 'بعد اجتياز الاختبار' },
  { value: 'on_test_time', label: 'بالتزامن مع موعد الاختبار' },
];

const DURATION_UNIT_OPTIONS: Array<{ value: DurationUnit; label: string }> = [
  { value: 'days', label: 'بالأيام' },
  { value: 'hours', label: 'بالساعات' },
];

export interface ControlScreensForm {
  acquaintanceDocumentsEntryResponsibleTestCode: string;
  acquaintanceDocumentsOpenTiming: DocumentTiming;
  acquaintanceDocumentsOpenOffsetValue: string;
  acquaintanceDocumentsOpenOffsetUnit: DurationUnit;
  acquaintanceDocumentsCloseResponsibleTestCode: string;
  acquaintanceDocumentsCloseTiming: DocumentTiming;
  acquaintanceDocumentsCloseOffsetValue: string;
  acquaintanceDocumentsCloseOffsetUnit: DurationUnit;
  applicationInstructionsText: string;
}

interface ApplicantControlScreensSettingsCardProps {
  form: ControlScreensForm;
  testOptions: Array<{ value: string; label: string }>;
  hasTests: boolean;
  showErrors: boolean;
  loading?: boolean;
  openDurationError?: string;
  closeDurationError?: string;
  onChange: <K extends keyof ControlScreensForm>(key: K, value: ControlScreensForm[K]) => void;
}

export function ApplicantControlScreensSettingsCard({
  form,
  testOptions,
  hasTests,
  showErrors,
  loading,
  openDurationError,
  closeDurationError,
  onChange,
}: ApplicantControlScreensSettingsCardProps): JSX.Element {
  const disabled = loading || !hasTests;

  return (
    <Card>
      <CardHeader
        title="إعدادات شاشات التحكم للمتقدمين"
        subtitle="تحديد الاختبار والتوقيت الذي يفتح أو يغلق وثيقة التعارف للمتقدم."
      />
      <CardBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <DocumentScheduleSection
            title="إعدادات فتح الوثيقة"
            testLabel="الاختبار"
            timingLabel="توقيت الفتح"
            timingHelper="اختر قبل موعد الاختبار، بعد اجتياز الاختبار، أو بالتزامن مع موعد الاختبار."
            testCode={form.acquaintanceDocumentsEntryResponsibleTestCode}
            timing={form.acquaintanceDocumentsOpenTiming}
            offsetValue={form.acquaintanceDocumentsOpenOffsetValue}
            offsetUnit={form.acquaintanceDocumentsOpenOffsetUnit}
            testOptions={testOptions}
            disabled={disabled}
            loading={loading}
            testError={showErrors && !form.acquaintanceDocumentsEntryResponsibleTestCode ? 'اختر اختباراً' : undefined}
            durationError={showErrors ? openDurationError : undefined}
            onTestChange={(value) => onChange('acquaintanceDocumentsEntryResponsibleTestCode', value)}
            onTimingChange={(value) => onChange('acquaintanceDocumentsOpenTiming', value)}
            onOffsetValueChange={(value) => onChange('acquaintanceDocumentsOpenOffsetValue', value)}
            onOffsetUnitChange={(value) => onChange('acquaintanceDocumentsOpenOffsetUnit', value)}
          />
          <DocumentScheduleSection
            title="إعدادات إغلاق الوثيقة"
            testLabel="الاختبار"
            timingLabel="توقيت الإغلاق"
            timingHelper="اختر قبل موعد الاختبار، بعد اجتياز الاختبار، أو بالتزامن مع موعد الاختبار."
            testCode={form.acquaintanceDocumentsCloseResponsibleTestCode}
            timing={form.acquaintanceDocumentsCloseTiming}
            offsetValue={form.acquaintanceDocumentsCloseOffsetValue}
            offsetUnit={form.acquaintanceDocumentsCloseOffsetUnit}
            testOptions={testOptions}
            disabled={disabled}
            loading={loading}
            testError={showErrors && !form.acquaintanceDocumentsCloseResponsibleTestCode ? 'اختر اختباراً' : undefined}
            durationError={showErrors ? closeDurationError : undefined}
            onTestChange={(value) => onChange('acquaintanceDocumentsCloseResponsibleTestCode', value)}
            onTimingChange={(value) => onChange('acquaintanceDocumentsCloseTiming', value)}
            onOffsetValueChange={(value) => onChange('acquaintanceDocumentsCloseOffsetValue', value)}
            onOffsetUnitChange={(value) => onChange('acquaintanceDocumentsCloseOffsetUnit', value)}
          />
        </div>
        <Textarea
          label="إرشادات التقدم"
          value={form.applicationInstructionsText}
          rows={6}
          disabled={loading}
          containerClassName="mt-4"
          helper="اكتب كل تعليمة في سطر مستقل. تظهر هذه التعليمات في درج إرشادات التقدم ببوابة المتقدم."
          onChange={(event) => onChange('applicationInstructionsText', event.target.value)}
        />
        <p className="mt-5 inline-flex items-center gap-2 border-t border-border-subtle pt-4 text-2xs text-ink-500">
          <Settings2 size={12} strokeWidth={1.75} aria-hidden />
          تُحفظ هذه القيم كإعدادات عامة وتُقرأها شاشات المتقدم عند تحديد الإتاحة.
        </p>
      </CardBody>
    </Card>
  );
}

interface DocumentScheduleSectionProps {
  title: string;
  testLabel: string;
  timingLabel: string;
  timingHelper: string;
  testCode: string;
  timing: DocumentTiming;
  offsetValue: string;
  offsetUnit: DurationUnit;
  testOptions: Array<{ value: string; label: string }>;
  disabled?: boolean;
  loading?: boolean;
  testError?: string;
  durationError?: string;
  onTestChange: (value: string) => void;
  onTimingChange: (value: DocumentTiming) => void;
  onOffsetValueChange: (value: string) => void;
  onOffsetUnitChange: (value: DurationUnit) => void;
}

function DocumentScheduleSection({
  title,
  testLabel,
  timingLabel,
  timingHelper,
  testCode,
  timing,
  offsetValue,
  offsetUnit,
  testOptions,
  disabled,
  loading,
  testError,
  durationError,
  onTestChange,
  onTimingChange,
  onOffsetValueChange,
  onOffsetUnitChange,
}: DocumentScheduleSectionProps): JSX.Element {
  const showsDuration = timing === 'before_test' || timing === 'after_test_passed';

  return (
    <section className="rounded-lg border border-border-subtle bg-ink-50/60 p-4">
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <div className="mt-3 flex flex-col gap-3">
        <Select
          label={testLabel}
          value={testCode}
          options={testOptions}
          disabled={disabled}
          error={testError}
          onChange={(event) => onTestChange(event.target.value)}
        />
        <Select
          label={timingLabel}
          value={timing}
          options={DOCUMENT_TIMING_OPTIONS}
          disabled={loading}
          helper={timingHelper}
          onChange={(event) => onTimingChange(event.target.value as DocumentTiming)}
        />
        {showsDuration && (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
            <Input
              label="المدة الزمنية"
              value={offsetValue}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              disabled={loading}
              error={durationError}
              helper="حدد المدة الزمنية المطلوبة بالنسبة لموعد الاختبار."
              onChange={(event) => onOffsetValueChange(event.target.value)}
            />
            <Select
              label="وحدة المدة"
              value={offsetUnit}
              options={DURATION_UNIT_OPTIONS}
              disabled={loading}
              onChange={(event) => onOffsetUnitChange(event.target.value as DurationUnit)}
            />
          </div>
        )}
      </div>
    </section>
  );
}
