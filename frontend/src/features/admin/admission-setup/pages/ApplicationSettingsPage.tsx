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

import { PageHeader } from '@/shared/components';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { CategoryAccordion } from '../components/applicationSettings/CategoryAccordion';
import { StickyBulkSaveBar } from '../components/applicationSettings/StickyBulkSaveBar';
import { UnsavedChangesPrompt } from '../components/applicationSettings/UnsavedChangesPrompt';

export function ApplicationSettingsPage(): JSX.Element {
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
