/**
 * Import validation rules derived from admission application settings.
 *
 * The import wizard validates NID-derived gender and age against the same
 * per-year settings admins maintain in admission setup. If the summary API
 * is unavailable, callers receive an empty rule set and the import falls
 * back to structural validation only.
 */

import { useMemo } from 'react';
import { useApplicationSettingsSummary } from '@/features/admin/admission-setup/api/applicationSettings.queries';
import { useImportWizardStore } from '../store/importWizard.store';
import {
  buildImportValidationRules,
  type ImportValidationRule,
} from './duplicateAudit';

export function useImportValidationRules(): readonly ImportValidationRule[] {
  const selectedSchoolCategories = useImportWizardStore((s) => s.selectedSchoolCategories);
  const graduationYear = useImportWizardStore((s) => s.graduationYear);
  const settingsQuery = useApplicationSettingsSummary(true);

  return useMemo(
    () =>
      buildImportValidationRules({
        settings: settingsQuery.data,
        selectedSchoolCategories,
        graduationYear,
      }),
    [settingsQuery.data, selectedSchoolCategories, graduationYear],
  );
}
