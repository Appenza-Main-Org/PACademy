/**
 * Admin Settings — general system settings exposed at /admin/settings.
 *
 * INTEGRATION CONTRACT:
 *   GET   /api/admin/settings                     → AdminSettings
 *   PATCH /api/admin/settings                     → AdminSettings
 *
 * Real backend stores these as rows in `settings` keyed by name. The
 * mock holds them in a single in-memory object so the wizard, applicant
 * portal, and admin pages can all read the same values.
 *
 * Settings exposed here:
 *   • `examDaysPerApplicant` — عدد أيام الاختبار للطالب — positive integer,
 *     default 3. Consumed by features that need to pace exam scheduling
 *     across multiple days per applicant.
 *   • `examSlotSelectionWindowDays` — مدة إتاحة اختيار موعد الاختبار
 *     للطالب — positive integer, default 7.
 */

import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';

export interface AdminSettings {
  /** عدد أيام الاختبار للطالب. Positive integer, default 3. */
  examDaysPerApplicant: number;
  /** مدة إتاحة اختيار موعد الاختبار للطالب. Positive integer, default 7. */
  examSlotSelectionWindowDays: number;
}

const DEFAULT_SETTINGS: AdminSettings = {
  examDaysPerApplicant: 3,
  examSlotSelectionWindowDays: 7,
};

const state: AdminSettings = { ...DEFAULT_SETTINGS };

export const adminSettingsService = {
  async get(): Promise<AdminSettings> {
    await simulateLatency(60, 120);
    return { ...state };
  },

  async update(patch: Partial<AdminSettings>): Promise<AdminSettings> {
    await simulateLatency();
    const before = { ...state };
    if (patch.examDaysPerApplicant !== undefined) {
      const next = patch.examDaysPerApplicant;
      if (!Number.isInteger(next) || next < 1) {
        throw new Error('عدد أيام الاختبار للطالب يجب أن يكون رقمًا صحيحًا موجبًا');
      }
      state.examDaysPerApplicant = next;
    }
    if (patch.examSlotSelectionWindowDays !== undefined) {
      const next = patch.examSlotSelectionWindowDays;
      if (!Number.isInteger(next) || next < 1) {
        throw new Error('مدة إتاحة اختيار موعد الاختبار للطالب يجب أن تكون رقمًا صحيحًا موجبًا');
      }
      state.examSlotSelectionWindowDays = next;
    }
    emitAudit({
      action: 'update',
      module: 'admin',
      entityType: 'admin.settings',
      entityLabel: 'الإعدادات العامة',
      entityId: 'admin-settings',
      details: 'تعديل الإعدادات العامة',
      before,
      after: { ...state },
    });
    return { ...state };
  },
};
