import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Button, PageHeader, toast } from '@/shared/components';
import {
  useAuthStore,
  useLockPolicy,
  useUpdateLockPolicy,
} from '@/features/auth';
import { useLookup } from '@/features/lookups/api/lookups.queries';
import { useAdminSettings, useUpdateAdminSettings } from '../api/settings.queries';
import { buildApplicantControlScreensSettingsPatch } from '../api/settings.service';
import { GeneralSettingsCard } from '../components/auth/GeneralSettingsCard';
import {
  ApplicantControlScreensSettingsCard,
  DEFAULT_LOCK_TIMING,
  type ControlScreensForm,
} from '../components/auth/ApplicantControlScreensSettingsCard';
import { LockPolicyCard } from '../components/auth/LockPolicyCard';

const EMPTY_CONTROL: ControlScreensForm = {
  acquaintanceDocumentsEntryResponsibleTestCode: '',
  acquaintanceDocumentsMutationLockTiming: DEFAULT_LOCK_TIMING,
  applicationInstructionsText: [
    'قبل التقدم: راجع البيانات المسجلة على بوابة وزارة الداخلية، وتأكد من صحتها.',
    'أثناء التقدم: سيطلب منك إدخال بيانات الدراسة بدقة. أي مخالفة قد تؤدي إلى منعك من الاختبار.',
    'مقابل الخدمة: يسدد مرة واحدة خلال الدورة الحالية من خلال وسيلة السداد المعتمدة.',
    'احرص على طباعة بطاقة التردد والإقرار قبل موعد أول اختبار، وعلى توقيعها من المتقدم وولي الأمر.',
  ].join('\n'),
};

export function SettingsPage(): JSX.Element {
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'super_admin');

  const settingsQuery = useAdminSettings();
  const updateSettings = useUpdateAdminSettings();
  const policyQuery = useLockPolicy();
  const updatePolicy = useUpdateLockPolicy();
  const testsQuery = useLookup('tests');

  const [examDays, setExamDays] = useState('');
  const [slotWindowDays, setSlotWindowDays] = useState('');
  const [control, setControl] = useState<ControlScreensForm>(EMPTY_CONTROL);
  const [lockMinutes, setLockMinutes] = useState(30);
  const [touched, setTouched] = useState(false);

  /* Hydrate once each server snapshot arrives. */
  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    setExamDays(data.examDaysPerApplicant != null ? String(data.examDaysPerApplicant) : '');
    setSlotWindowDays(
      data.examSlotSelectionWindowDays != null ? String(data.examSlotSelectionWindowDays) : '',
    );
    setControl({
      acquaintanceDocumentsEntryResponsibleTestCode: data.acquaintanceDocumentsEntryResponsibleTestCode ?? '',
      acquaintanceDocumentsMutationLockTiming: data.acquaintanceDocumentsMutationLockTiming ?? DEFAULT_LOCK_TIMING,
      applicationInstructionsText: formatInstructionsText(data.applicationInstructions),
    });
  }, [settingsQuery.data]);

  useEffect(() => {
    if (policyQuery.data) setLockMinutes(policyQuery.data.lockDurationMinutes);
  }, [policyQuery.data]);

  const testOptions = useMemo(() => {
    const rows = [...(testsQuery.data ?? [])].sort((a, b) => a.order - b.order);
    return [
      { value: '', label: rows.length ? 'اختر الاختبار' : 'لا توجد اختبارات معرفة' },
      ...rows.map((row) => ({ value: row.code, label: `${row.order}. ${row.name}` })),
    ];
  }, [testsQuery.data]);

  const hasTests = (testsQuery.data?.length ?? 0) > 0;

  const parsedExamDays = examDays === '' ? null : Number(examDays);
  const parsedSlotWindow = slotWindowDays === '' ? null : Number(slotWindowDays);
  const isExamDaysInvalid =
    parsedExamDays === null || !Number.isInteger(parsedExamDays) || parsedExamDays < 1;
  const isSlotWindowInvalid =
    parsedSlotWindow === null || !Number.isInteger(parsedSlotWindow) || parsedSlotWindow < 1;
  const isControlInvalid = !control.acquaintanceDocumentsEntryResponsibleTestCode;
  const isInvalid = isExamDaysInvalid || isSlotWindowInvalid || isControlInvalid;

  const isPending = updateSettings.isPending || updatePolicy.isPending;
  const isLoading = settingsQuery.isLoading || policyQuery.isLoading;

  const patchControl = <K extends keyof ControlScreensForm>(key: K, value: ControlScreensForm[K]): void => {
    setControl((current) => ({ ...current, [key]: value }));
  };

  const onSave = async (): Promise<void> => {
    setTouched(true);
    if (isInvalid || !hasTests) return;
    try {
      await Promise.all([
        updateSettings.mutateAsync({
          examDaysPerApplicant: parsedExamDays!,
          examSlotSelectionWindowDays: parsedSlotWindow!,
          ...buildApplicantControlScreensSettingsPatch({
            acquaintanceDocumentsEntryResponsibleTestCode: control.acquaintanceDocumentsEntryResponsibleTestCode,
            acquaintanceDocumentsMutationLockTiming: control.acquaintanceDocumentsMutationLockTiming,
            applicationInstructions: parseInstructionsText(control.applicationInstructionsText),
          }),
        }),
        updatePolicy.mutateAsync({ lockDurationMinutes: lockMinutes }),
      ]);
      toast('تم حفظ جميع الإعدادات', 'success');
    } catch (err) {
      toast((err as Error).message, 'danger');
    }
  };

  return (
    <>
      <PageHeader title="الإعدادات العامة" subtitle="ضبط سياسات الأمان وقفل الحسابات" />

      {isSuperAdmin && (
        <div className="mt-5 flex flex-col gap-5">
          <GeneralSettingsCard
            examDays={examDays}
            slotWindowDays={slotWindowDays}
            examDaysError={touched && isExamDaysInvalid ? 'يجب أن يكون رقمًا صحيحًا موجبًا' : undefined}
            slotWindowError={touched && isSlotWindowInvalid ? 'يجب أن يكون رقمًا صحيحًا موجبًا' : undefined}
            loading={settingsQuery.isLoading}
            onExamDaysChange={setExamDays}
            onSlotWindowChange={setSlotWindowDays}
            onBlur={() => setTouched(true)}
          />
          <ApplicantControlScreensSettingsCard
            form={control}
            testOptions={testOptions}
            hasTests={hasTests}
            showErrors={touched}
            loading={settingsQuery.isLoading || testsQuery.isLoading}
            onChange={patchControl}
          />
          <LockPolicyCard
            lockMinutes={lockMinutes}
            loading={policyQuery.isLoading}
            onLockMinutesChange={setLockMinutes}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <p className="text-2xs text-ink-500">
              يُحفظ كل ما سبق دفعة واحدة عند الضغط على «حفظ جميع الإعدادات».
            </p>
            <Button
              variant="primary"
              size="md"
              isLoading={isPending}
              disabled={isPending || isLoading || !hasTests}
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              onClick={onSave}
            >
              حفظ جميع الإعدادات
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function formatInstructionsText(lines: readonly string[] | undefined): string {
  const normalized = lines?.map((line) => line.trim()).filter(Boolean);
  return normalized && normalized.length > 0
    ? normalized.join('\n')
    : EMPTY_CONTROL.applicationInstructionsText;
}

function parseInstructionsText(value: string): readonly string[] {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines : EMPTY_CONTROL.applicationInstructionsText.split('\n');
}
