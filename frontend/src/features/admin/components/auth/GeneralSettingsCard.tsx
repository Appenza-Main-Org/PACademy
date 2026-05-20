/**
 * GeneralSettingsCard — surfaces the general admin-side settings on
 * /admin/settings (super-admin only). Currently exposes
 * «عدد أيام الاختبار للطالب» and «مدة إتاحة اختيار موعد الاختبار
 * للطالب» — positive integers backed by `adminSettingsService`.
 *
 * The input mirrors the existing admin numeric-input pattern: strict
 * keystroke filtering (digits only), `inputMode="numeric"`, and inline
 * Arabic validation. Save is a single Save button that fires the
 * `useUpdateAdminSettings` mutation; the TanStack Query refetch keeps
 * the form in sync with any future consumer that reads
 * the settings snapshot.
 */

import { useEffect, useState } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  toast,
} from '@/shared/components';
import { useAdminSettings, useUpdateAdminSettings } from '../../api/settings.queries';

const EXAM_DAYS_LABEL = 'عدد أيام الاختبار للطالب';
const SLOT_WINDOW_LABEL = 'مدة إتاحة اختيار موعد الاختبار للطالب';

export function GeneralSettingsCard(): JSX.Element {
  const settingsQuery = useAdminSettings();
  const updateMut = useUpdateAdminSettings();

  const [examDays, setExamDays] = useState<string>('');
  const [slotWindowDays, setSlotWindowDays] = useState<string>('');
  const [touched, setTouched] = useState(false);

  /* Hydrate local state once the server snapshot arrives. */
  useEffect(() => {
    if (settingsQuery.data) {
      setExamDays(String(settingsQuery.data.examDaysPerApplicant));
      setSlotWindowDays(String(settingsQuery.data.examSlotSelectionWindowDays));
    }
  }, [settingsQuery.data]);

  const parsedExamDays = examDays === '' ? null : Number(examDays);
  const parsedSlotWindowDays = slotWindowDays === '' ? null : Number(slotWindowDays);
  const isExamDaysInvalid =
    touched &&
    (parsedExamDays === null || !Number.isInteger(parsedExamDays) || parsedExamDays < 1);
  const isSlotWindowInvalid =
    touched &&
    (parsedSlotWindowDays === null ||
      !Number.isInteger(parsedSlotWindowDays) ||
      parsedSlotWindowDays < 1);
  const isInvalid = isExamDaysInvalid || isSlotWindowInvalid;
  const examDaysError = isExamDaysInvalid ? 'يجب أن يكون رقمًا صحيحًا موجبًا' : undefined;
  const slotWindowError = isSlotWindowInvalid ? 'يجب أن يكون رقمًا صحيحًا موجبًا' : undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const sanitizeNumber = (raw: string): string => raw.replace(/\D/g, '').replace(/^0+/, '');

  const handleExamDaysChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setExamDays(sanitizeNumber(e.target.value));
  };

  const handleSlotWindowChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSlotWindowDays(sanitizeNumber(e.target.value));
  };

  const onSave = (): void => {
    setTouched(true);
    if (
      parsedExamDays === null ||
      !Number.isInteger(parsedExamDays) ||
      parsedExamDays < 1 ||
      parsedSlotWindowDays === null ||
      !Number.isInteger(parsedSlotWindowDays) ||
      parsedSlotWindowDays < 1
    ) {
      return;
    }
    updateMut.mutate(
      {
        examDaysPerApplicant: parsedExamDays,
        examSlotSelectionWindowDays: parsedSlotWindowDays,
      },
      {
        onSuccess: () => toast('تم حفظ الإعدادات العامة', 'success'),
        onError: (err) => toast(err.message, 'danger'),
      },
    );
  };

  const isDirty =
    settingsQuery.data !== undefined &&
    parsedExamDays !== null &&
    parsedSlotWindowDays !== null &&
    (parsedExamDays !== settingsQuery.data.examDaysPerApplicant ||
      parsedSlotWindowDays !== settingsQuery.data.examSlotSelectionWindowDays);

  return (
    <Card>
      <CardHeader
        title="إعدادات الاختبارات"
        subtitle="ضوابط مشتركة تستخدمها وحدات إدارة الاختبارات والجداول."
      />
      <CardBody>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <Input
            label={EXAM_DAYS_LABEL}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={examDays}
            onKeyDown={handleKeyDown}
            onChange={handleExamDaysChange}
            onBlur={() => setTouched(true)}
            error={examDaysError}
            aria-label={EXAM_DAYS_LABEL}
            disabled={settingsQuery.isLoading}
          />
          <Input
            label={SLOT_WINDOW_LABEL}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={slotWindowDays}
            onKeyDown={handleKeyDown}
            onChange={handleSlotWindowChange}
            onBlur={() => setTouched(true)}
            error={slotWindowError}
            aria-label={SLOT_WINDOW_LABEL}
            disabled={settingsQuery.isLoading}
          />
          <div className="flex items-end">
            <Button
              variant="primary"
              size="md"
              isLoading={updateMut.isPending}
              disabled={!isDirty || isInvalid}
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              onClick={onSave}
            >
              حفظ الإعدادات
            </Button>
          </div>
        </div>
        <p className="mt-3 inline-flex items-center gap-2 text-2xs text-ink-500">
          <CalendarDays size={12} strokeWidth={1.75} aria-hidden />
          عدد أيام الاختبار الافتراضي ٣، ومدة اختيار الموعد الافتراضية ٧ أيام.
        </p>
      </CardBody>
    </Card>
  );
}
