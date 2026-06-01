/**
 * Admin Settings — general system settings exposed at /admin/settings.
 *
 * INTEGRATION CONTRACT:
 *   GET   /api/admin/settings → AdminSettings
 *   PATCH /api/admin/settings → AdminSettings
 */

import { apiClient } from '@/shared/lib/api-client';

export interface AdminSettings {
  /** عدد أيام الاختبار للطالب. Positive integer, default 3. */
  examDaysPerApplicant: number;
  /** عدد الأيام المسموح للطالب خلالها باختيار موعد الاختبار قبل تاريخ الاختبار. Positive integer, default 1. */
  examSlotSelectionWindowDays: number;
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
  /** الاختبار المسؤول عن إغلاق وثيقة التعارف. */
  acquaintanceDocumentsCloseResponsibleTestCode?: string;
  /** توقيت إغلاق وثيقة التعارف بالنسبة للاختبار المختار. */
  acquaintanceDocumentsCloseTiming?: 'before_test' | 'after_test_passed' | 'on_test_time';
  /** مقدار مدة إغلاق وثيقة التعارف عند اختيار قبل/بعد الاختبار. */
  acquaintanceDocumentsCloseOffsetValue?: number | null;
  /** وحدة مدة إغلاق وثيقة التعارف. */
  acquaintanceDocumentsCloseOffsetUnit?: 'days' | 'hours';
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
  | 'acquaintanceDocumentsCloseResponsibleTestCode'
  | 'acquaintanceDocumentsCloseTiming'
  | 'acquaintanceDocumentsCloseOffsetValue'
  | 'acquaintanceDocumentsCloseOffsetUnit'
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
    acquaintanceDocumentsCloseResponsibleTestCode: settings.acquaintanceDocumentsCloseResponsibleTestCode,
    acquaintanceDocumentsCloseTiming: settings.acquaintanceDocumentsCloseTiming,
    acquaintanceDocumentsCloseOffsetValue: settings.acquaintanceDocumentsCloseOffsetValue,
    acquaintanceDocumentsCloseOffsetUnit: settings.acquaintanceDocumentsCloseOffsetUnit,
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
