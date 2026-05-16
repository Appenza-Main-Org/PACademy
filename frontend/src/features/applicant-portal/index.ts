export { ApplicantPortalLayout, STAGE_KEYS as APPLICANT_STAGE_KEYS, STAGE_LABELS as APPLICANT_STAGE_LABELS } from './ApplicantPortalLayout';
export { ApplicantPreWizardLayout } from './ApplicantPreWizardLayout';
export { ApplicantPortalPage } from './pages/ApplicantPortalPage';
export { Stage1AuthPhonePage } from './pages/Stage1AuthPhonePage';
export { Stage2AuthSmsPage } from './pages/Stage2AuthSmsPage';

/* MOI-aligned: the old Stage 3 / 4 / 5 pages are gone — their content is
 * collapsed into Stage345ApplicantDataPage per the reference flow (PDF p.4). */
export { Stage345ApplicantDataPage } from './pages/Stage345ApplicantDataPage';
export { VerifyApplicantPage } from './pages/VerifyApplicantPage';

export { Stage6PaymentPage } from './pages/Stage6PaymentPage';
export { Stage7FamilyPage } from './pages/Stage7FamilyPage';
export { Stage8ExamSchedulePage } from './pages/Stage8ExamSchedulePage';
export { Stage9PrintCardPage } from './pages/Stage9PrintCardPage';
export { Stage10FollowUpPage } from './pages/Stage10FollowUpPage';
export { Stage11AcquaintanceDocPage } from './pages/Stage11AcquaintanceDocPage';

/* Post-polish gate — Bucket B */
export { CategorySelectionPage } from './pages/CategorySelectionPage';
export { EligibilityCheckPage } from './pages/EligibilityCheckPage';
export { useApplicantPortalStore } from './store/applicantPortal.store';

/* Post-polish test schedule — Bucket C */
export { TestScheduleAndResultsPage } from './pages/TestScheduleAndResultsPage';

/* AF-3 — applicant-facing تعديل الطلب edit surface */
export { ApplicationSummaryPage } from './pages/ApplicationSummaryPage';
