/**
 * Step 1 — إعدادات التقديم.
 *
 * Three-tier global master-data editor:
 *   ApplicantCategoryConfig → ApplicantCategorySpecialization → ApplicantSpecializationYear
 *
 * The page reads `applicant-categories` and `specializations` from the
 * existing lookup catalogue and never seeds new lookup
 * rows. It is intentionally cycle-agnostic — these rows are global
 * master data and the banner makes that explicit.
 *
 * Wizard chrome (left rail / right column / sticky footer) is owned by
 * `<AdmissionSetupWizardPage />`. This page just renders body content.
 */

import { useEffect } from 'react';
import { PageHeader } from '@/shared/components';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { CategoryEducationFieldsCard } from '../components/applicationSettings/CategoryEducationFieldsCard';
import { CategoryTabs } from '../components/applicationSettings/CategoryTabs';
import { StickyBulkSaveBar } from '../components/applicationSettings/StickyBulkSaveBar';
import { UnsavedChangesPrompt } from '../components/applicationSettings/UnsavedChangesPrompt';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  hydrateApplicationSettingsCycleDraft,
  writeApplicationSettingsCycleDraft,
} from '../lib/application-settings-cycle-draft';
import { useAdmissionSetupWizardStore } from '../store/wizardSharedState';

export function ApplicationSettingsPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const cycleId = cycle?.id ?? null;

  useEffect(() => {
    if (!cycleId) return undefined;
    void hydrateApplicationSettingsCycleDraft(cycleId);
    const unsubscribe = useAdmissionSetupWizardStore.subscribe(() => {
      writeApplicationSettingsCycleDraft(cycleId);
    });
    return unsubscribe;
  }, [cycleId]);

  return (
    <AdmissionSetupShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="إعدادات التقديم"
          subtitle="مساحة عمل منظمة لإضافة شروط اللجنة لكل فئة على حدة مع متابعة حالة الاكتمال."
        />
        <CategoryTabs />
        <CategoryEducationFieldsCard />
        <StickyBulkSaveBar />
        <UnsavedChangesPrompt />
      </div>
    </AdmissionSetupShell>
  );
}
