/**
 * ApplicantControlScreensSettingsCard — general settings for applicant
 * control-screen visibility gates. Values are stored in the existing
 * `/api/admin/settings` singleton so backend consumers can resolve which
 * admission test unlocks each applicant-facing screen.
 *
 * Usage:
 *   <ApplicantControlScreensSettingsCard />
 */

import { useEffect, useMemo, useState } from 'react';
import { Save, Settings2 } from 'lucide-react';
import { useLookup } from '@/features/lookups/api/lookups.queries';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Select,
  toast,
} from '@/shared/components';
import { useAdminSettings, useUpdateAdminSettings } from '../../api/settings.queries';
import {
  buildApplicantControlScreensSettingsPatch,
  type AdminSettings,
} from '../../api/settings.service';

type LockTiming = NonNullable<AdminSettings['acquaintanceDocumentsMutationLockTiming']>;

const LOCK_TIMING_OPTIONS: Array<{ value: LockTiming; label: string }> = [
  { value: 'on_test_start', label: 'عند بدء الاختبار المحدد' },
  { value: 'on_test_end', label: 'بعد انتهاء الاختبار المحدد' },
  { value: 'after_print', label: 'بعد طباعة وثيقة التعارف' },
  { value: 'manual', label: 'يدوي بواسطة المسؤول' },
];

const DEFAULT_LOCK_TIMING: LockTiming = 'on_test_start';

interface FormState {
  primaryRelativesEntryResponsibleTestCode: string;
  acquaintanceDocumentsEntryResponsibleTestCode: string;
  acquaintanceDocumentsPrintResponsibleTestCode: string;
  acquaintanceDocumentsMutationLockTiming: LockTiming;
}

function toForm(settings?: AdminSettings): FormState {
  return {
    primaryRelativesEntryResponsibleTestCode: settings?.primaryRelativesEntryResponsibleTestCode ?? '',
    acquaintanceDocumentsEntryResponsibleTestCode: settings?.acquaintanceDocumentsEntryResponsibleTestCode ?? '',
    acquaintanceDocumentsPrintResponsibleTestCode: settings?.acquaintanceDocumentsPrintResponsibleTestCode ?? '',
    acquaintanceDocumentsMutationLockTiming:
      settings?.acquaintanceDocumentsMutationLockTiming ?? DEFAULT_LOCK_TIMING,
  };
}

function isSameForm(a: FormState, b: FormState): boolean {
  return Object.keys(a).every((key) => a[key as keyof FormState] === b[key as keyof FormState]);
}

export function ApplicantControlScreensSettingsCard(): JSX.Element {
  const settingsQuery = useAdminSettings();
  const updateMut = useUpdateAdminSettings();
  const testsQuery = useLookup('tests');
  const [form, setForm] = useState<FormState>(() => toForm());
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) setForm(toForm(settingsQuery.data));
  }, [settingsQuery.data]);

  const testOptions = useMemo(() => {
    const rows = [...(testsQuery.data ?? [])].sort((a, b) => a.order - b.order);
    return [
      { value: '', label: rows.length ? 'اختر الاختبار' : 'لا توجد اختبارات معرفة' },
      ...rows.map((row) => ({ value: row.code, label: `${row.order}. ${row.name}` })),
    ];
  }, [testsQuery.data]);

  const hasTests = (testsQuery.data?.length ?? 0) > 0;
  const isInvalid =
    touched &&
    (!form.primaryRelativesEntryResponsibleTestCode ||
      !form.acquaintanceDocumentsEntryResponsibleTestCode ||
      !form.acquaintanceDocumentsPrintResponsibleTestCode);
  const initialForm = toForm(settingsQuery.data);
  const isDirty = settingsQuery.data !== undefined && !isSameForm(form, initialForm);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSave = (): void => {
    setTouched(true);
    if (isInvalid || !hasTests) return;
    updateMut.mutate(
      buildApplicantControlScreensSettingsPatch(form),
      {
        onSuccess: () => toast('تم حفظ إعدادات شاشات التحكم', 'success'),
        onError: (err) => toast(err.message, 'danger'),
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title="إعدادات شاشات التحكم للمتقدمين"
        subtitle="تحديد الاختبار أو المرحلة التي تُظهر شاشات الأقارب ووثائق التعارف."
      />
      <CardBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <Select
            label="الاختبار المسؤول عن إظهار شاشات إدراج بيانات الأقارب الأولية"
            value={form.primaryRelativesEntryResponsibleTestCode}
            options={testOptions}
            disabled={settingsQuery.isLoading || testsQuery.isLoading || !hasTests}
            error={isInvalid && !form.primaryRelativesEntryResponsibleTestCode ? 'اختر اختباراً' : undefined}
            onChange={(event) => patch('primaryRelativesEntryResponsibleTestCode', event.target.value)}
          />
          <Select
            label="الاختبار المسؤول عن إظهار شاشات إدراج وثائق التعارف"
            value={form.acquaintanceDocumentsEntryResponsibleTestCode}
            options={testOptions}
            disabled={settingsQuery.isLoading || testsQuery.isLoading || !hasTests}
            error={isInvalid && !form.acquaintanceDocumentsEntryResponsibleTestCode ? 'اختر اختباراً' : undefined}
            onChange={(event) => patch('acquaintanceDocumentsEntryResponsibleTestCode', event.target.value)}
          />
          <Select
            label="الاختبار المسؤول عن إظهار شاشات طباعة وثائق التعارف"
            value={form.acquaintanceDocumentsPrintResponsibleTestCode}
            options={testOptions}
            disabled={settingsQuery.isLoading || testsQuery.isLoading || !hasTests}
            error={isInvalid && !form.acquaintanceDocumentsPrintResponsibleTestCode ? 'اختر اختباراً' : undefined}
            onChange={(event) => patch('acquaintanceDocumentsPrintResponsibleTestCode', event.target.value)}
          />
          <Select
            label="توقيت غلق الإدراج والحذف والتعديل لوثائق التعارف"
            value={form.acquaintanceDocumentsMutationLockTiming}
            options={LOCK_TIMING_OPTIONS}
            disabled={settingsQuery.isLoading}
            onChange={(event) =>
              patch('acquaintanceDocumentsMutationLockTiming', event.target.value as LockTiming)
            }
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <p className="inline-flex items-center gap-2 text-2xs text-ink-500">
            <Settings2 size={12} strokeWidth={1.75} aria-hidden />
            تُحفظ هذه القيم كإعدادات عامة وتُقرأها شاشات المتقدم عند تحديد الإتاحة.
          </p>
          <Button
            variant="primary"
            size="md"
            isLoading={updateMut.isPending}
            disabled={!isDirty || updateMut.isPending || !hasTests}
            leadingIcon={<Save size={14} strokeWidth={1.75} />}
            onClick={onSave}
          >
            حفظ إعدادات الشاشات
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
