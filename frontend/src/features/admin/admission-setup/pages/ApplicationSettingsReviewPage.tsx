/**
 * Step 1.5 — مراجعة إعدادات التقديم لكل فئة.
 *
 * Read-only checkpoint between authoring (`application_settings`) and
 * the rest of the admission-setup wizard. The review reads the saved
 * application-settings tree from the service, so returning to the active
 * cycle later still shows previously authored category settings.
 */

import { Printer } from 'lucide-react';
import { Button, PageHeader } from '@/shared/components';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { ApprovedCategoryCompositionsSummary } from '../components/ApprovedCategoryCompositionsSummary';

/* Print: landscape A4 fits the wide row tables comfortably; tighter
 * font keeps two-column data legible on paper. The global print.css
 * already hides chrome-side elements that carry `.no-print`. */
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 12mm 10mm; }
  .app-settings-review-print table { font-size: 9pt; }
  .app-settings-review-print thead th { font-size: 8pt; }
}
`;

export function ApplicationSettingsReviewPage(): JSX.Element {
  return (
    <AdmissionSetupShell>
      <style>{PRINT_CSS}</style>
      <div className="app-settings-review-print flex flex-col gap-4">
        <PageHeader
          title="مراجعة إعدادات التقديم لكل فئة"
          subtitle="مراجعة قراءة فقط للإعدادات المحفوظة على الفئات في دورة القبول النشطة."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Printer size={14} strokeWidth={1.75} aria-hidden />}
              onClick={() => window.print()}
            >
              طباعة
            </Button>
          }
        />
        <ApprovedCategoryCompositionsSummary />
      </div>
    </AdmissionSetupShell>
  );
}

export function ApplicationSettingsReviewBody(): JSX.Element {
  return <ApprovedCategoryCompositionsSummary />;
}
