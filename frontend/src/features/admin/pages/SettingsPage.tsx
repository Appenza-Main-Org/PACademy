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
import {
  DEFAULT_APPLICANT_SESSION_TIMEOUT_MINUTES,
  DEFAULT_STAFF_SESSION_TIMEOUT_MINUTES,
  buildApplicantControlScreensSettingsPatch,
} from '../api/settings.service';
import { GeneralSettingsCard } from '../components/auth/GeneralSettingsCard';
import {
  ApplicantControlScreensSettingsCard,
  DEFAULT_DOCUMENT_TIMING,
  DEFAULT_DURATION_UNIT,
  type DocumentTiming,
  type ControlScreensForm,
} from '../components/auth/ApplicantControlScreensSettingsCard';
import { LockPolicyCard } from '../components/auth/LockPolicyCard';

const EMPTY_CONTROL: ControlScreensForm = {
  acquaintanceDocumentsEntryResponsibleTestCode: '',
  acquaintanceDocumentsOpenTiming: DEFAULT_DOCUMENT_TIMING,
  acquaintanceDocumentsOpenOffsetValue: '',
  acquaintanceDocumentsOpenOffsetUnit: DEFAULT_DURATION_UNIT,
  acquaintanceDocumentsOpenResultCode: '',
  acquaintanceDocumentsCloseResponsibleTestCode: '',
  acquaintanceDocumentsCloseTiming: DEFAULT_DOCUMENT_TIMING,
  acquaintanceDocumentsCloseOffsetValue: '',
  acquaintanceDocumentsCloseOffsetUnit: DEFAULT_DURATION_UNIT,
  acquaintanceDocumentsCloseResultCode: '',
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
  const testResultsQuery = useLookup('test-results');

  const [examDays, setExamDays] = useState('');
  const [slotWindowDays, setSlotWindowDays] = useState('');
  const [staffSessionTimeoutMinutes, setStaffSessionTimeoutMinutes] = useState(
    String(DEFAULT_STAFF_SESSION_TIMEOUT_MINUTES),
  );
  const [applicantSessionTimeoutMinutes, setApplicantSessionTimeoutMinutes] = useState(
    String(DEFAULT_APPLICANT_SESSION_TIMEOUT_MINUTES),
  );
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
    setStaffSessionTimeoutMinutes(String(
      data.staffSessionTimeoutMinutes ?? DEFAULT_STAFF_SESSION_TIMEOUT_MINUTES,
    ));
    setApplicantSessionTimeoutMinutes(String(
      data.applicantSessionTimeoutMinutes ?? DEFAULT_APPLICANT_SESSION_TIMEOUT_MINUTES,
    ));
    setControl({
      acquaintanceDocumentsEntryResponsibleTestCode: data.acquaintanceDocumentsEntryResponsibleTestCode ?? '',
      acquaintanceDocumentsOpenTiming: data.acquaintanceDocumentsOpenTiming ?? DEFAULT_DOCUMENT_TIMING,
      acquaintanceDocumentsOpenOffsetValue: formatOptionalNumber(data.acquaintanceDocumentsOpenOffsetValue),
      acquaintanceDocumentsOpenOffsetUnit: data.acquaintanceDocumentsOpenOffsetUnit ?? DEFAULT_DURATION_UNIT,
      acquaintanceDocumentsOpenResultCode: data.acquaintanceDocumentsOpenResultCode ?? '',
      acquaintanceDocumentsCloseResponsibleTestCode:
        data.acquaintanceDocumentsCloseResponsibleTestCode
        ?? data.acquaintanceDocumentsPrintResponsibleTestCode
        ?? data.acquaintanceDocumentsEntryResponsibleTestCode
        ?? '',
      acquaintanceDocumentsCloseTiming:
        data.acquaintanceDocumentsCloseTiming
        ?? mapLegacyLockTiming(data.acquaintanceDocumentsMutationLockTiming),
      acquaintanceDocumentsCloseOffsetValue: formatOptionalNumber(data.acquaintanceDocumentsCloseOffsetValue),
      acquaintanceDocumentsCloseOffsetUnit: data.acquaintanceDocumentsCloseOffsetUnit ?? DEFAULT_DURATION_UNIT,
      acquaintanceDocumentsCloseResultCode: data.acquaintanceDocumentsCloseResultCode ?? '',
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

  const resultOptions = useMemo(() => {
    return (testResultsQuery.data ?? [])
      .filter((row) => row.isActive)
      .map((row) => ({ value: row.code, label: row.name }));
  }, [testResultsQuery.data]);

  const hasTests = (testsQuery.data?.length ?? 0) > 0;
  const hasResults = resultOptions.length > 0;

  const parsedExamDays = examDays === '' ? null : Number(examDays);
  const parsedSlotWindow = slotWindowDays === '' ? null : Number(slotWindowDays);
  const parsedStaffSessionTimeout = staffSessionTimeoutMinutes === ''
    ? null
    : Number(staffSessionTimeoutMinutes);
  const parsedApplicantSessionTimeout = applicantSessionTimeoutMinutes === ''
    ? null
    : Number(applicantSessionTimeoutMinutes);
  const isExamDaysInvalid =
    parsedExamDays === null || !Number.isInteger(parsedExamDays) || parsedExamDays < 1;
  const isSlotWindowInvalid =
    parsedSlotWindow === null || !Number.isInteger(parsedSlotWindow) || parsedSlotWindow < 1;
  const isStaffSessionTimeoutInvalid =
    parsedStaffSessionTimeout === null ||
    !Number.isInteger(parsedStaffSessionTimeout) ||
    parsedStaffSessionTimeout < 5 ||
    parsedStaffSessionTimeout > 120;
  const isApplicantSessionTimeoutInvalid =
    parsedApplicantSessionTimeout === null ||
    !Number.isInteger(parsedApplicantSessionTimeout) ||
    parsedApplicantSessionTimeout < 15 ||
    parsedApplicantSessionTimeout > 240;
  const parsedOpenOffset = parseOptionalNumber(control.acquaintanceDocumentsOpenOffsetValue);
  const parsedCloseOffset = parseOptionalNumber(control.acquaintanceDocumentsCloseOffsetValue);
  const isOpenOffsetInvalid = isDurationRequired(control.acquaintanceDocumentsOpenTiming)
    && (parsedOpenOffset === null || !Number.isInteger(parsedOpenOffset) || parsedOpenOffset < 1);
  const isCloseOffsetInvalid = isDurationRequired(control.acquaintanceDocumentsCloseTiming)
    && (parsedCloseOffset === null || !Number.isInteger(parsedCloseOffset) || parsedCloseOffset < 1);
  const isOpenResultInvalid = isResultRequired(control.acquaintanceDocumentsOpenTiming)
    && !control.acquaintanceDocumentsOpenResultCode;
  const isCloseResultInvalid = isResultRequired(control.acquaintanceDocumentsCloseTiming)
    && !control.acquaintanceDocumentsCloseResultCode;
  const isControlInvalid =
    !control.acquaintanceDocumentsEntryResponsibleTestCode
    || !control.acquaintanceDocumentsCloseResponsibleTestCode
    || isOpenOffsetInvalid
    || isCloseOffsetInvalid
    || isOpenResultInvalid
    || isCloseResultInvalid;
  const isInvalid =
    isExamDaysInvalid ||
    isSlotWindowInvalid ||
    isStaffSessionTimeoutInvalid ||
    isApplicantSessionTimeoutInvalid ||
    isControlInvalid;

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
          staffSessionTimeoutMinutes: parsedStaffSessionTimeout!,
          applicantSessionTimeoutMinutes: parsedApplicantSessionTimeout!,
          ...buildApplicantControlScreensSettingsPatch({
            acquaintanceDocumentsEntryResponsibleTestCode: control.acquaintanceDocumentsEntryResponsibleTestCode,
            acquaintanceDocumentsOpenTiming: control.acquaintanceDocumentsOpenTiming,
            acquaintanceDocumentsOpenOffsetValue: isDurationRequired(control.acquaintanceDocumentsOpenTiming)
              ? parsedOpenOffset
              : null,
            acquaintanceDocumentsOpenOffsetUnit: control.acquaintanceDocumentsOpenOffsetUnit,
            acquaintanceDocumentsOpenResultCode: isResultRequired(control.acquaintanceDocumentsOpenTiming)
              ? control.acquaintanceDocumentsOpenResultCode
              : null,
            acquaintanceDocumentsCloseResponsibleTestCode: control.acquaintanceDocumentsCloseResponsibleTestCode,
            acquaintanceDocumentsCloseTiming: control.acquaintanceDocumentsCloseTiming,
            acquaintanceDocumentsCloseOffsetValue: isDurationRequired(control.acquaintanceDocumentsCloseTiming)
              ? parsedCloseOffset
              : null,
            acquaintanceDocumentsCloseOffsetUnit: control.acquaintanceDocumentsCloseOffsetUnit,
            acquaintanceDocumentsCloseResultCode: isResultRequired(control.acquaintanceDocumentsCloseTiming)
              ? control.acquaintanceDocumentsCloseResultCode
              : null,
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
            staffSessionTimeoutMinutes={staffSessionTimeoutMinutes}
            applicantSessionTimeoutMinutes={applicantSessionTimeoutMinutes}
            examDaysError={touched && isExamDaysInvalid ? 'يجب أن يكون رقمًا صحيحًا موجبًا' : undefined}
            slotWindowError={touched && isSlotWindowInvalid ? 'يجب أن يكون رقمًا صحيحًا موجبًا' : undefined}
            staffSessionTimeoutError={
              touched && isStaffSessionTimeoutInvalid ? 'القيمة المسموحة من ٥ إلى ١٢٠ دقيقة' : undefined
            }
            applicantSessionTimeoutError={
              touched && isApplicantSessionTimeoutInvalid ? 'القيمة المسموحة من ١٥ إلى ٢٤٠ دقيقة' : undefined
            }
            loading={settingsQuery.isLoading}
            onExamDaysChange={setExamDays}
            onSlotWindowChange={setSlotWindowDays}
            onStaffSessionTimeoutMinutesChange={setStaffSessionTimeoutMinutes}
            onApplicantSessionTimeoutMinutesChange={setApplicantSessionTimeoutMinutes}
            onBlur={() => setTouched(true)}
          />
          <ApplicantControlScreensSettingsCard
            form={control}
            testOptions={testOptions}
            resultOptions={resultOptions}
            hasTests={hasTests}
            hasResults={hasResults}
            showErrors={touched}
            loading={settingsQuery.isLoading || testsQuery.isLoading || testResultsQuery.isLoading}
            openDurationError={isOpenOffsetInvalid ? 'أدخل مدة صحيحة أكبر من صفر' : undefined}
            closeDurationError={isCloseOffsetInvalid ? 'أدخل مدة صحيحة أكبر من صفر' : undefined}
            openResultError={isOpenResultInvalid ? 'اختر حالة النتيجة' : undefined}
            closeResultError={isCloseResultInvalid ? 'اختر حالة النتيجة' : undefined}
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

function formatOptionalNumber(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

function parseOptionalNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

function isDurationRequired(timing: DocumentTiming): boolean {
  return timing === 'before_test' || timing === 'after_test_passed';
}

function isResultRequired(timing: DocumentTiming): boolean {
  return timing === 'after_test_passed';
}

function mapLegacyLockTiming(
  timing: 'on_test_start' | 'on_test_end' | 'after_print' | 'manual' | undefined,
): DocumentTiming {
  if (timing === 'on_test_end' || timing === 'after_print') return 'after_test_passed';
  return DEFAULT_DOCUMENT_TIMING;
}
