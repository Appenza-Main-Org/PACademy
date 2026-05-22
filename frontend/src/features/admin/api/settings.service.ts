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
}

export const adminSettingsService = {
  async get(): Promise<AdminSettings> {
    return apiClient.get('/api/admin/settings');
  },

  async update(patch: Partial<AdminSettings>): Promise<AdminSettings> {
    return apiClient.patch('/api/admin/settings', patch);
  },
};
