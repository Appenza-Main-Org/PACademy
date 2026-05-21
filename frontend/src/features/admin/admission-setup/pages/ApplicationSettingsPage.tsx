/**
 * Step 1 — إعدادات التقديم.
 *
 * Three-tier global master-data editor:
 *   ApplicantCategoryConfig → ApplicantCategorySpecialization → ApplicantSpecializationYear
 *
 * The page reads `applicant-categories` and `specializations` from the
 * existing lookup catalogue (`MOCK.lookups`) and never seeds new lookup
 * rows. It is intentionally cycle-agnostic — these rows are global
 * master data and the banner makes that explicit.
 *
 * Wizard chrome (left rail / right column / sticky footer) is owned by
 * `<AdmissionSetupWizardPage />`. This page just renders body content.
 */

import { useEffect } from 'react';
import { PageHeader } from '@/shared/components';
import { useApplicationRuleRows } from '../api/applicationSettings.queries';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { CategoryAccordion } from '../components/applicationSettings/CategoryAccordion';
import { StickyBulkSaveBar } from '../components/applicationSettings/StickyBulkSaveBar';
import { UnsavedChangesPrompt } from '../components/applicationSettings/UnsavedChangesPrompt';
import { useAdmissionSetupWizardStore } from '../store/wizardSharedState';

export function ApplicationSettingsPage(): JSX.Element {
  const ruleRowsQuery = useApplicationRuleRows();
  const hydratePersistedRows = useAdmissionSetupWizardStore(
    (s) => s.hydratePersistedRows,
  );
  const authoredRowCount = useAdmissionSetupWizardStore(
    (s) => s.local.length + s.approved.length,
  );

  useEffect(() => {
    if (!ruleRowsQuery.data) return;
    if (authoredRowCount > 0 && ruleRowsQuery.data.length === 0) return;
    hydratePersistedRows(ruleRowsQuery.data);
  }, [authoredRowCount, hydratePersistedRows, ruleRowsQuery.data]);

  return (
    <AdmissionSetupShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="إعدادات التقديم"
          subtitle="مساحة عمل منظمة لإضافة شروط اللجنة لكل فئة على حدة مع متابعة حالة الاكتمال."
        />
        <CategoryAccordion />
        <StickyBulkSaveBar />
        <UnsavedChangesPrompt />
      </div>
    </AdmissionSetupShell>
  );
}
