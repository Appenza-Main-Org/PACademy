/**
 * Admin Settings — general system settings exposed at /admin/settings.
 *
 * INTEGRATION CONTRACT:
 *   GET   /api/admin/settings → AdminSettings
 *   PATCH /api/admin/settings → AdminSettings
 */

import { apiClient } from '@/shared/lib/api-client';

export const DEFAULT_STAFF_SESSION_TIMEOUT_MINUTES = 30;
export const DEFAULT_APPLICANT_SESSION_TIMEOUT_MINUTES = 120;

export interface AdminSettings {
  /** عدد أيام الاختبار للطالب. Positive integer, default 3. */
  examDaysPerApplicant: number;
  /** عدد الأيام المسموح للطالب خلالها باختيار موعد الاختبار قبل تاريخ الاختبار. Positive integer, default 1. */
  examSlotSelectionWindowDays: number;
  /** مدة انتهاء جلسة الموظفين بعد عدم النشاط بالدقائق. Recommended 30. */
  staffSessionTimeoutMinutes?: number;
  /** مدة انتهاء جلسة المتقدم بعد عدم النشاط بالدقائق. Recommended 120. */
  applicantSessionTimeoutMinutes?: number;
  /** الاختبار المسؤول عن إظهار شاشات إدراج بيانات الأقارب الأولية. */
  primaryRelativesEntryResponsibleTestCode?: string;
  /** الاختبار المسؤول عن إظهار شاشات إدراج وثائق التعارف. */
  acquaintanceDocumentsEntryResponsibleTestCode?: string;
  /** الاختبار المسؤول عن إظهار شاشات طباعة وثائق التعارف. */
  acquaintanceDocumentsPrintResponsibleTestCode?: string;
  /** توقيت غلق الإدراج/الحذف/التعديل لوثائق التعارف. */
  acquaintanceDocumentsMutationLockTiming?: 'on_test_start' | 'on_test_end' | 'after_print' | 'manual';
  /** توقيت فتح وثيقة التعارف بالنسبة للاختبار المختار. */
  acquaintanceDocumentsOpenTiming?: 'before_test' | 'after_test_passed' | 'on_test_time';
  /** مقدار مدة فتح وثيقة التعارف عند اختيار قبل/بعد الاختبار. */
  acquaintanceDocumentsOpenOffsetValue?: number | null;
  /** وحدة مدة فتح وثيقة التعارف. */
  acquaintanceDocumentsOpenOffsetUnit?: 'days' | 'hours';
  /** كود نتيجة الاختبار (من lookup `test-results`) الذي يُفعّل فتح الوثيقة عند اختيار «بعد ظهور النتيجة». */
  acquaintanceDocumentsOpenResultCode?: string | null;
  /** الاختبار المسؤول عن إغلاق وثيقة التعارف. */
  acquaintanceDocumentsCloseResponsibleTestCode?: string;
  /** توقيت إغلاق وثيقة التعارف بالنسبة للاختبار المختار. */
  acquaintanceDocumentsCloseTiming?: 'before_test' | 'after_test_passed' | 'on_test_time';
  /** مقدار مدة إغلاق وثيقة التعارف عند اختيار قبل/بعد الاختبار. */
  acquaintanceDocumentsCloseOffsetValue?: number | null;
  /** وحدة مدة إغلاق وثيقة التعارف. */
  acquaintanceDocumentsCloseOffsetUnit?: 'days' | 'hours';
  /** كود نتيجة الاختبار (من lookup `test-results`) الذي يُفعّل إغلاق الوثيقة عند اختيار «بعد ظهور النتيجة». */
  acquaintanceDocumentsCloseResultCode?: string | null;
  /** المرحلة/الاختبار المسؤول عن إظهار شاشات الأقارب الأولية. */
  primaryRelativesVisibilityResponsibleTestCode?: string;
  /** Applicant-facing application instructions shown in the portal drawer. */
  applicationInstructions?: readonly string[];
}

export type ApplicantControlScreensSettingsPatch = Pick<
  AdminSettings,
  | 'acquaintanceDocumentsEntryResponsibleTestCode'
  | 'acquaintanceDocumentsOpenTiming'
  | 'acquaintanceDocumentsOpenOffsetValue'
  | 'acquaintanceDocumentsOpenOffsetUnit'
  | 'acquaintanceDocumentsOpenResultCode'
  | 'acquaintanceDocumentsCloseResponsibleTestCode'
  | 'acquaintanceDocumentsCloseTiming'
  | 'acquaintanceDocumentsCloseOffsetValue'
  | 'acquaintanceDocumentsCloseOffsetUnit'
  | 'acquaintanceDocumentsCloseResultCode'
  | 'applicationInstructions'
>;

export function buildApplicantControlScreensSettingsPatch(
  settings: ApplicantControlScreensSettingsPatch,
): ApplicantControlScreensSettingsPatch {
  return {
    acquaintanceDocumentsEntryResponsibleTestCode: settings.acquaintanceDocumentsEntryResponsibleTestCode,
    acquaintanceDocumentsOpenTiming: settings.acquaintanceDocumentsOpenTiming,
    acquaintanceDocumentsOpenOffsetValue: settings.acquaintanceDocumentsOpenOffsetValue,
    acquaintanceDocumentsOpenOffsetUnit: settings.acquaintanceDocumentsOpenOffsetUnit,
    acquaintanceDocumentsOpenResultCode: settings.acquaintanceDocumentsOpenResultCode,
    acquaintanceDocumentsCloseResponsibleTestCode: settings.acquaintanceDocumentsCloseResponsibleTestCode,
    acquaintanceDocumentsCloseTiming: settings.acquaintanceDocumentsCloseTiming,
    acquaintanceDocumentsCloseOffsetValue: settings.acquaintanceDocumentsCloseOffsetValue,
    acquaintanceDocumentsCloseOffsetUnit: settings.acquaintanceDocumentsCloseOffsetUnit,
    acquaintanceDocumentsCloseResultCode: settings.acquaintanceDocumentsCloseResultCode,
    applicationInstructions: settings.applicationInstructions,
  };
}

export const adminSettingsService = {
  async get(): Promise<AdminSettings> {
    return apiClient.get('/api/admin/settings');
  },

  async update(patch: Partial<AdminSettings>): Promise<AdminSettings> {
    return apiClient.patch('/api/admin/settings', patch);
  },
};
