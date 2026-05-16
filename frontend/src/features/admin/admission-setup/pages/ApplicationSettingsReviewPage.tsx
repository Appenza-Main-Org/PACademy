/**
 * Step 1.5 — مراجعة إعدادات التقديم لكل فئة.
 *
 * Read-only checkpoint between authoring (`application_settings`) and
 * the final approval gate (`review`). Renders the shared
 * `ApprovedCategoryCompositionsSummary` so both checkpoints surface the
 * exact same view of what the admin entered — no divergence possible.
 *
 * Every field authored in `application_settings` lives on the year-row
 * shape (`ApplicantSpecializationYear`): graduation years, gender,
 * marital status, age cap, grade gate (TAGDIR or GRADES branch),
 * application window, age reference date, school category (for
 * `officers_general`), and per-row active flag. The summary table
 * renders all of them — there is no parallel "other fields" surface to
 * mirror.
 *
 * The previous/next navigation is owned by the wizard shell
 * (`AdmissionSetupWizardPage`): previous resolves to
 * `application_settings`, next to `fees`. The shell's «إرسال للاعتماد»
 * button still fires from the final config step (electronic_declaration)
 * and lands on the final `review` step.
 */

import { PageHeader } from '@/shared/components';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { ApprovedCategoryCompositionsSummary } from '../components/ApprovedCategoryCompositionsSummary';

export function ApplicationSettingsReviewPage(): JSX.Element {
  return (
    <AdmissionSetupShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="مراجعة إعدادات التقديم لكل فئة"
          subtitle="مراجعة قراءة فقط لما تم إدخاله في خطوة «إعدادات التقديم»."
        />
        <ApprovedCategoryCompositionsSummary />
      </div>
    </AdmissionSetupShell>
  );
}
