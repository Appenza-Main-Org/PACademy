/**
 * GeneralSettingsCard — surfaces the general admin-side settings on
 * /admin/settings (super-admin only). Currently exposes
 * «عدد أيام الاختبار للطالب» — positive integer, default 3 — backed by
 * `adminSettingsService`.
 *
 * The input mirrors the existing admin numeric-input pattern: strict
 * keystroke filtering (digits only), `inputMode="numeric"`, and inline
 * Arabic validation. Save is a single Save button that fires the
 * `useUpdateAdminSettings` mutation; the TanStack Query refetch keeps
 * the form in sync with any future consumer that reads
 * `examDaysPerApplicant`.
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

const FIELD_LABEL = 'عدد أيام الاختبار للطالب';

export function GeneralSettingsCard(): JSX.Element {
  const settingsQuery = useAdminSettings();
  const updateMut = useUpdateAdminSettings();

  const [examDays, setExamDays] = useState<string>('');
  const [touched, setTouched] = useState(false);

  /* Hydrate local state once the server snapshot arrives. */
  useEffect(() => {
    if (settingsQuery.data) {
      setExamDays(String(settingsQuery.data.examDaysPerApplicant));
    }
  }, [settingsQuery.data]);

  const parsed = examDays === '' ? null : Number(examDays);
  const isInvalid =
    touched &&
    (parsed === null || !Number.isInteger(parsed) || parsed < 1);
  const errorMessage = isInvalid ? 'يجب أن يكون رقمًا صحيحًا موجبًا' : undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
    setExamDays(digits);
  };

  const onSave = (): void => {
    setTouched(true);
    if (parsed === null || !Number.isInteger(parsed) || parsed < 1) return;
    updateMut.mutate(
      { examDaysPerApplicant: parsed },
      {
        onSuccess: () => toast('تم حفظ الإعدادات العامة', 'success'),
        onError: (err) => toast(err.message, 'danger'),
      },
    );
  };

  const isDirty =
    settingsQuery.data !== undefined &&
    parsed !== null &&
    parsed !== settingsQuery.data.examDaysPerApplicant;

  return (
    <Card>
      <CardHeader
        title="إعدادات الاختبارات"
        subtitle="ضوابط مشتركة تستخدمها وحدات إدارة الاختبارات والجداول."
      />
      <CardBody>
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label={FIELD_LABEL}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={examDays}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            error={errorMessage}
            aria-label={FIELD_LABEL}
            disabled={settingsQuery.isLoading}
          />
          <div className="flex items-end md:col-span-2">
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
          عدد أيام يُقسّم عليها جدول اختبارات الطالب الواحد. القيمة الافتراضية ٣.
        </p>
      </CardBody>
    </Card>
  );
}
