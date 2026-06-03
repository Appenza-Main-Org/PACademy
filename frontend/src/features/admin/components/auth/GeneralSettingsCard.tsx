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
 *     staffSessionTimeoutMinutes={staffSessionTimeoutMinutes}
 *     applicantSessionTimeoutMinutes={applicantSessionTimeoutMinutes}
 *     onExamDaysChange={setExamDays}
 *     onSlotWindowChange={setSlotWindowDays}
 *     onStaffSessionTimeoutMinutesChange={setStaffSessionTimeoutMinutes}
 *     onApplicantSessionTimeoutMinutesChange={setApplicantSessionTimeoutMinutes}
 *   />
 */

import type { KeyboardEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import { Card, CardBody, CardHeader, Input } from '@/shared/components';

const EXAM_DAYS_LABEL = 'عدد أيام الاختبار للطالب';
const SLOT_WINDOW_LABEL = 'عدد الأيام المسموح للطالب خلالها باختيار موعد الاختبار قبل تاريخ الاختبار';
const STAFF_SESSION_TIMEOUT_LABEL = 'انتهاء جلسة الموظفين بالدقائق';
const APPLICANT_SESSION_TIMEOUT_LABEL = 'انتهاء جلسة المتقدم بالدقائق';

const sanitizeNumber = (raw: string): string => raw.replace(/\D/g, '').replace(/^0+/, '');

interface GeneralSettingsCardProps {
  examDays: string;
  slotWindowDays: string;
  staffSessionTimeoutMinutes: string;
  applicantSessionTimeoutMinutes: string;
  examDaysError?: string;
  slotWindowError?: string;
  staffSessionTimeoutError?: string;
  applicantSessionTimeoutError?: string;
  loading?: boolean;
  onExamDaysChange: (value: string) => void;
  onSlotWindowChange: (value: string) => void;
  onStaffSessionTimeoutMinutesChange: (value: string) => void;
  onApplicantSessionTimeoutMinutesChange: (value: string) => void;
  onBlur?: () => void;
}

export function GeneralSettingsCard({
  examDays,
  slotWindowDays,
  staffSessionTimeoutMinutes,
  applicantSessionTimeoutMinutes,
  examDaysError,
  slotWindowError,
  staffSessionTimeoutError,
  applicantSessionTimeoutError,
  loading,
  onExamDaysChange,
  onSlotWindowChange,
  onStaffSessionTimeoutMinutesChange,
  onApplicantSessionTimeoutMinutesChange,
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
        title="إعدادات عامة"
        subtitle="ضوابط مشتركة للاختبارات وانتهاء الجلسات."
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
          <Input
            label={STAFF_SESSION_TIMEOUT_LABEL}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={staffSessionTimeoutMinutes}
            onKeyDown={handleKeyDown}
            onChange={(e) => onStaffSessionTimeoutMinutesChange(sanitizeNumber(e.target.value))}
            onBlur={onBlur}
            error={staffSessionTimeoutError}
            aria-label={STAFF_SESSION_TIMEOUT_LABEL}
            disabled={loading}
          />
          <Input
            label={APPLICANT_SESSION_TIMEOUT_LABEL}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={applicantSessionTimeoutMinutes}
            onKeyDown={handleKeyDown}
            onChange={(e) => onApplicantSessionTimeoutMinutesChange(sanitizeNumber(e.target.value))}
            onBlur={onBlur}
            error={applicantSessionTimeoutError}
            aria-label={APPLICANT_SESSION_TIMEOUT_LABEL}
            disabled={loading}
          />
        </div>
        <p className="mt-3 inline-flex items-center gap-2 text-2xs text-ink-500">
          <CalendarDays size={12} strokeWidth={1.75} aria-hidden />
          القيم المقترحة: جلسة الموظفين ٣٠ دقيقة، وجلسة المتقدمين ١٢٠ دقيقة.
        </p>
      </CardBody>
    </Card>
  );
}
