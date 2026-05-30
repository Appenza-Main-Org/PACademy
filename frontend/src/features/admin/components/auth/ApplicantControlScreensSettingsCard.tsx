/**
 * ApplicantControlScreensSettingsCard — applicant control-screen visibility
 * gates section of /admin/settings. Determines which admission test unlocks
 * each applicant-facing screen (relatives entry, acquaintance-doc open/lock).
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
import { Card, CardBody, CardHeader, Select } from '@/shared/components';
import type { AdminSettings } from '../../api/settings.service';

export type LockTiming = NonNullable<AdminSettings['acquaintanceDocumentsMutationLockTiming']>;

export const DEFAULT_LOCK_TIMING: LockTiming = 'on_test_start';

const LOCK_TIMING_OPTIONS: Array<{ value: LockTiming; label: string }> = [
  { value: 'on_test_start', label: 'عند بدء الاختبار المحدد' },
  { value: 'on_test_end', label: 'بعد انتهاء الاختبار المحدد' },
  { value: 'after_print', label: 'بعد طباعة وثيقة التعارف' },
  { value: 'manual', label: 'يدوي بواسطة المسؤول' },
];

export interface ControlScreensForm {
  acquaintanceDocumentsEntryResponsibleTestCode: string;
  acquaintanceDocumentsMutationLockTiming: LockTiming;
}

interface ApplicantControlScreensSettingsCardProps {
  form: ControlScreensForm;
  testOptions: Array<{ value: string; label: string }>;
  hasTests: boolean;
  showErrors: boolean;
  loading?: boolean;
  onChange: <K extends keyof ControlScreensForm>(key: K, value: ControlScreensForm[K]) => void;
}

export function ApplicantControlScreensSettingsCard({
  form,
  testOptions,
  hasTests,
  showErrors,
  loading,
  onChange,
}: ApplicantControlScreensSettingsCardProps): JSX.Element {
  const disabled = loading || !hasTests;

  return (
    <Card>
      <CardHeader
        title="إعدادات شاشات التحكم للمتقدمين"
        subtitle="تحديد الاختبار أو المرحلة التي تُظهر شاشات الأقارب ووثائق التعارف."
      />
      <CardBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <Select
            label="تحديد الاختبار المسؤول عن فتح إدراج وثائق التعارف"
            value={form.acquaintanceDocumentsEntryResponsibleTestCode}
            options={testOptions}
            disabled={disabled}
            error={showErrors && !form.acquaintanceDocumentsEntryResponsibleTestCode ? 'اختر اختباراً' : undefined}
            onChange={(event) => onChange('acquaintanceDocumentsEntryResponsibleTestCode', event.target.value)}
          />
          <Select
            label="توقيت غلق الإدراج والحذف والتعديل لوثائق التعارف"
            value={form.acquaintanceDocumentsMutationLockTiming}
            options={LOCK_TIMING_OPTIONS}
            disabled={loading}
            onChange={(event) =>
              onChange('acquaintanceDocumentsMutationLockTiming', event.target.value as LockTiming)
            }
          />
        </div>
        <p className="mt-5 inline-flex items-center gap-2 border-t border-border-subtle pt-4 text-2xs text-ink-500">
          <Settings2 size={12} strokeWidth={1.75} aria-hidden />
          تُحفظ هذه القيم كإعدادات عامة وتُقرأها شاشات المتقدم عند تحديد الإتاحة.
        </p>
      </CardBody>
    </Card>
  );
}
