/**
 * GeneralSettingsCard — exam-control section of /admin/settings
 * («عدد أيام الاختبار للطالب» + «عدد الأيام المسموح ... قبل تاريخ الاختبار»).
 *
 * Presentational + controlled: form state, validation, and persistence are
 * owned by the parent SettingsPage so the whole page saves with one button.
 * The numeric inputs keep the admin numeric-input pattern (digits only,
 * `inputMode="numeric"`, inline Arabic validation).
 *
 * Usage:
 *   <GeneralSettingsCard
 *     examDays={examDays}
 *     slotWindowDays={slotWindowDays}
 *     onExamDaysChange={setExamDays}
 *     onSlotWindowChange={setSlotWindowDays}
 *   />
 */

import type { KeyboardEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import { Card, CardBody, CardHeader, Input } from '@/shared/components';

const EXAM_DAYS_LABEL = 'عدد أيام الاختبار للطالب';
const SLOT_WINDOW_LABEL = 'عدد الأيام المسموح للطالب خلالها باختيار موعد الاختبار قبل تاريخ الاختبار';

const sanitizeNumber = (raw: string): string => raw.replace(/\D/g, '').replace(/^0+/, '');

interface GeneralSettingsCardProps {
  examDays: string;
  slotWindowDays: string;
  examDaysError?: string;
  slotWindowError?: string;
  loading?: boolean;
  onExamDaysChange: (value: string) => void;
  onSlotWindowChange: (value: string) => void;
  onBlur?: () => void;
}

export function GeneralSettingsCard({
  examDays,
  slotWindowDays,
  examDaysError,
  slotWindowError,
  loading,
  onExamDaysChange,
  onSlotWindowChange,
  onBlur,
}: GeneralSettingsCardProps): JSX.Element {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <Card>
      <CardHeader
        title="إعدادات الاختبارات"
        subtitle="ضوابط مشتركة تستخدمها وحدات إدارة الاختبارات والجداول."
      />
      <CardBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label={EXAM_DAYS_LABEL}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={examDays}
            onKeyDown={handleKeyDown}
            onChange={(e) => onExamDaysChange(sanitizeNumber(e.target.value))}
            onBlur={onBlur}
            error={examDaysError}
            aria-label={EXAM_DAYS_LABEL}
            disabled={loading}
          />
          <Input
            label={SLOT_WINDOW_LABEL}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={slotWindowDays}
            onKeyDown={handleKeyDown}
            onChange={(e) => onSlotWindowChange(sanitizeNumber(e.target.value))}
            onBlur={onBlur}
            error={slotWindowError}
            aria-label={SLOT_WINDOW_LABEL}
            disabled={loading}
          />
        </div>
        <p className="mt-3 inline-flex items-center gap-2 text-2xs text-ink-500">
          <CalendarDays size={12} strokeWidth={1.75} aria-hidden />
          عدد أيام الاختبار الافتراضي ٣، ومدة اختيار الموعد الافتراضية يوم واحد.
        </p>
      </CardBody>
    </Card>
  );
}
