/**
 * Category education-field config — read side for the applicant portal.
 *
 * Drives the config-driven educational score fields on the profile page
 * (/applicant/profile): which fields render per category, their Arabic
 * labels, and their validation rules (required / min / max / kind).
 * Categories with no admin-stored rows answer with backend defaults, so
 * the page never falls back to hardcoded field definitions.
 *
 * INTEGRATION CONTRACT:
 *   GET /api/admission-setup/education-fields?categoryKey=<key>
 *     → CategoryEducationField[] (active+inactive, sorted by sortOrder)
 *   (admin write side lives in features/admin/admission-setup —
 *    PUT /api/admission-setup/education-fields/:categoryKey)
 */

import { adminApiClient } from '@/shared/lib/api-client';
import type { CategoryEducationField } from '@/shared/types/domain';

export const educationFieldsService = {
  async listByCategory(categoryKey: string): Promise<CategoryEducationField[]> {
    return adminApiClient.get<CategoryEducationField[]>(
      '/api/admission-setup/education-fields',
      { query: { categoryKey } },
    );
  },
};
