export { ApplicantPortalLayout, STAGE_KEYS as APPLICANT_STAGE_KEYS, STAGE_LABELS as APPLICANT_STAGE_LABELS } from './ApplicantPortalLayout';
export { ApplicantPreWizardLayout } from './ApplicantPreWizardLayout';
export { ApplicantPortalPage } from './pages/ApplicantPortalPage';

/* MOI-aligned: the legacy phone/SMS auth (Stage 1+2) is gone — the
 * applicant arrives already-authenticated via the moi.gov.eg SSO. The
 * old Stage 3 / 4 / 5 pages are likewise collapsed into
 * Stage345ApplicantDataPage per the reference flow (PDF p.4). */
export { Stage345ApplicantDataPage } from './pages/Stage345ApplicantDataPage';

export { Stage6PaymentPage } from './pages/Stage6PaymentPage';
export { Stage7FamilyPage } from './pages/Stage7FamilyPage';
export { Stage7ReviewFamilyPage } from './pages/Stage7ReviewFamilyPage';
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
export { ApplicationFormPage } from './pages/ApplicationFormPage';

/* MOI-driven rejection screen — shown when MOI returned a session for
 * an applicant who doesn't qualify for any open category. */
export { ApplicantIneligiblePage } from './pages/ApplicantIneligiblePage';

/* Admin-facing portal follow-up access — lets the admin reach a portal
 * applicant's exam outcomes from an admin record (bridged by national ID). */
export {
  useAdminPortalStatus,
  useFollowUpExamPlan,
  useUpdateFollowUpMutation,
} from './api/applicantPortal.queries';
export type { AdminPortalStatus } from './api/applicantPortal.service';
export type { FollowUpExam, FollowUpExamPlan } from './lib/follow-up-exam-plan';

/* Acquaintance-document (وثيقة التعارف) section taxonomy — consumed read-only
 * by the admin applicant-detail mirror so the portal, admin, and export planes
 * share one section ordering + labels. */
export {
  GROUP_KEYS as ACQUAINTANCE_GROUP_KEYS,
  GROUP_LABELS as ACQUAINTANCE_GROUP_LABELS,
} from './lib/vothiqaTaaruf.types';
export type { GroupKey as AcquaintanceGroupKey } from './lib/vothiqaTaaruf.types';
