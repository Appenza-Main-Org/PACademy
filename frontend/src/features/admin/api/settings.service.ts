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
  /** المرحلة/الاختبار المسؤول عن إظهار شاشات الأقارب الأولية. */
  primaryRelativesVisibilityResponsibleTestCode?: string;
}

export type ApplicantControlScreensSettingsPatch = Pick<
  AdminSettings,
  | 'acquaintanceDocumentsEntryResponsibleTestCode'
  | 'acquaintanceDocumentsMutationLockTiming'
>;

export function buildApplicantControlScreensSettingsPatch(
  settings: ApplicantControlScreensSettingsPatch,
): ApplicantControlScreensSettingsPatch {
  return {
    acquaintanceDocumentsEntryResponsibleTestCode: settings.acquaintanceDocumentsEntryResponsibleTestCode,
    acquaintanceDocumentsMutationLockTiming: settings.acquaintanceDocumentsMutationLockTiming,
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
