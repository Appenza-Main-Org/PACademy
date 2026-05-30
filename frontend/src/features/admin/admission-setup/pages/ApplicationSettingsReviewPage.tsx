/**
 * Step 1.5 — مراجعة إعدادات التقديم لكل فئة.
 *
 * Read-only checkpoint between authoring (`application_settings`) and
 * the rest of the admission-setup wizard. The review reads the saved
 * application-settings tree from the service, so returning to the active
 * cycle later still shows previously authored category settings.
 */

import { useEffect } from 'react';
import { Printer } from 'lucide-react';
import { Button, PageHeader } from '@/shared/components';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { ApprovedCategoryCompositionsSummary } from '../components/ApprovedCategoryCompositionsSummary';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { hydrateApplicationSettingsCycleDraft } from '../lib/application-settings-cycle-draft';

/* Print: landscape A4 fits the wide row tables comfortably; tighter
 * font keeps two-column data legible on paper. The global print.css
 * already hides chrome-side elements that carry `.no-print`. */
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 18mm 12mm 12mm; }
  body:has(.app-settings-review-print) .app-settings-review-print {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 2mm 0 0 !important;
    overflow: visible !important;
  }
  body:has(.app-settings-review-print) #root,
  body:has(.app-settings-review-print) .page-enter,
  body:has(.app-settings-review-print) main {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  /* The AppShell renders a staff <header> + sidebar <aside> inside a CSS
   * grid body (md:grid-cols-[256px_1fr]). The global print.css hides chrome
   * via legacy .header/.sidebar class selectors this React shell never uses,
   * so the chrome leaks into print and the 256px sidebar track squeezes the
   * wide landscape tables off the page edge (cropped output). Hide the chrome
   * and collapse the grid wrapper so <main> prints full-bleed — same model
   * the /architecture handout uses. */
  body:has(.app-settings-review-print) .page-enter > header,
  body:has(.app-settings-review-print) .page-enter aside {
    display: none !important;
  }
  body:has(.app-settings-review-print) .page-enter > div:has(> main) {
    display: block !important;
    min-height: 0 !important;
    overflow: visible !important;
  }
  body:has(.app-settings-review-print) main {
    padding: 0 !important;
  }
  .app-settings-review-print-header {
    display: block !important;
    margin: 0 0 6mm !important;
    padding: 0 0 4mm !important;
    border-bottom: 1px solid var(--border-default);
    break-after: avoid;
    page-break-after: avoid;
    overflow: visible !important;
  }
  .app-settings-review-print-kicker {
    margin: 0 0 2mm !important;
    font-family: var(--font-ar);
    font-size: 9pt;
    line-height: 1.4;
    color: var(--ink-500);
  }
  .app-settings-review-print-title {
    margin: 0 !important;
    font-family: var(--font-ar-display);
    font-size: 18pt;
    font-weight: var(--weight-bold);
    line-height: 1.5;
    color: var(--ink-900);
    overflow: visible !important;
  }
  .app-settings-review-print-subtitle {
    margin: 1.5mm 0 0 !important;
    font-family: var(--font-ar);
    font-size: 9pt;
    line-height: 1.5;
    color: var(--ink-600);
  }
  /* The year/spec tables carry an on-screen min-width (≈1680px for the
   * 15-column university grid) + per-cell min-widths so the horizontal
   * scroller works. On paper that's far wider than A4 landscape (~1032px
   * printable) and bled off the page edge — the real crop. Drop the
   * min-widths and pin the table to the page width with a fixed layout so
   * every column wraps in place instead of overflowing. */
  .app-settings-review-print table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
    font-size: 7pt;
  }
  .app-settings-review-print thead th { font-size: 6.5pt; }
  .app-settings-review-print th,
  .app-settings-review-print td {
    min-width: 0 !important;
    padding: 2px 3px !important;
    white-space: normal !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .app-settings-review-print .overflow-x-auto { overflow: visible !important; }
  .app-settings-review-print [data-print-card] {
    display: block !important;
    break-inside: auto;
    page-break-inside: auto;
    overflow: visible !important;
  }
  .app-settings-review-print [data-print-card] + [data-print-card] {
    break-before: auto;
    page-break-before: auto;
  }
}
`;

const REVIEW_TITLE = 'مراجعة إعدادات التقديم لكل فئة';
const REVIEW_SUBTITLE = 'مراجعة قراءة فقط للإعدادات المحفوظة على الفئات في دورة القبول النشطة.';

export function ApplicationSettingsReviewPage(): JSX.Element {
  useHydrateApplicationSettingsDraft();

  return (
    <AdmissionSetupShell>
      <style>{PRINT_CSS}</style>
      <div className="app-settings-review-print flex flex-col gap-4">
        <div className="no-print">
          <PageHeader
            title={REVIEW_TITLE}
            subtitle={REVIEW_SUBTITLE}
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
        </div>
        <header className="app-settings-review-print-header print-only" aria-hidden>
          <p className="app-settings-review-print-kicker">
            وزارة الداخلية · أكاديمية الشرطة
          </p>
          <h1 className="app-settings-review-print-title">{REVIEW_TITLE}</h1>
          <p className="app-settings-review-print-subtitle">{REVIEW_SUBTITLE}</p>
        </header>
        <ApprovedCategoryCompositionsSummary />
      </div>
    </AdmissionSetupShell>
  );
}

export function ApplicationSettingsReviewBody(): JSX.Element {
  useHydrateApplicationSettingsDraft();

  return <ApprovedCategoryCompositionsSummary />;
}

function useHydrateApplicationSettingsDraft(): void {
  const { cycle } = useAdmissionSetupCycle();
  const cycleId = cycle?.id ?? null;

  useEffect(() => {
    if (!cycleId) return;
    hydrateApplicationSettingsCycleDraft(cycleId);
  }, [cycleId]);
}
