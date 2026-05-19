/**
 * Route registry — every route in the app maps here.
 * Source: ARCH-04 (public/private split).
 *
 * Three surfaces:
 *  - PUBLIC (no auth)   → /, /applicant-login, /staff-login, /terms, /help
 *  - APPLICANT (Stage1+2 auth) → /applicant/*
 *  - STAFF (AuthGuard)  → /hub, /admin/*, /committee/*, /board/*, /investigations/*,
 *                         /medical/*, /barcode/*, /biometric/*, /question-bank/*,
 *                         /architecture, /profile
 */

import { Navigate, useParams, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@/app/providers/AuthGuard';
import { LoginPage, ApplicantLoginPage } from '@/features/auth';
import { ROUTES } from '@/config/routes';
import { HubPage } from '@/features/hub';
import { ArchitecturePage } from '@/features/architecture';
import { RevampComparisonPage } from '@/features/design-revamp';
import { ProfilePage } from '@/features/profile';
import { HelpPage } from '@/features/help';
import { PublicLandingPage, TermsPage } from '@/features/landing';
import {
  ApplicantGradesImportReviewPage,
  AppSettingsReviewPage,
  LookupsReviewPage,
  PrimitivesReviewPage,
} from '@/features/dev';
import { LookupsHubPage } from '@/features/lookups/pages/LookupsHubPage';
import { ApplicantCategoryDetailPage } from '@/features/lookups/pages/ApplicantCategoryDetailPage';
import {
  ApplicantIneligiblePage,
  ApplicantPortalLayout,
  ApplicationSummaryPage,
  ApplicantPortalPage,
  ApplicantPreWizardLayout,
  CategorySelectionPage,
  EligibilityCheckPage,
  Stage10FollowUpPage,
  Stage11AcquaintanceDocPage,
  Stage345ApplicantDataPage,
  Stage6PaymentPage,
  Stage7FamilyPage,
  Stage7ReviewFamilyPage,
  Stage8ExamSchedulePage,
  Stage9PrintCardPage,
  TestScheduleAndResultsPage,
} from '@/features/applicant-portal';
import {
  AdminLayout,
  AdmissionSetupIndexPage,
  AdmissionSetupWizardPage,
  ApplicantDetailPage,
  ApplicantEditPage,
  ApplicantNewPage,
  ApplicantsPage,
  AdmissionFeesPage,
  ApplicationSettingsPage,
  ApplicationSettingsReviewPage,
  ApplicationStatusPage,
  AuditPage,
  CategoriesListPage,
  CategoryEditPage,
  CommitteeInstancesPage,
  CommitteesManagementPage,
  CycleDetailPage,
  CycleEditPage,
  CycleNewPage,
  CyclesPage,
  ElectronicDeclarationPage,
  ExamsManagementPage,
  NotificationsPage,
  PaymentsPage,
  ReportsPage,
  RolesPage,
  SettingsPage,
  UsersPage,
  UserCreatePage,
  UserDetailPage,
  UserEditPage,
  WorkflowEditorPage,
  WorkflowsListPage,
} from '@/features/admin';
import {
  CommitteeApplicantsPage,
  CommitteeCreatePage,
  CommitteeDetailPage,
  CommitteeEditPage,
  CommitteeOverviewPage,
  CommitteeSchedulePage,
} from '@/features/committees';
import {
  BoardDecisionsListPage,
  BoardDecisionsPage,
  BoardLayout,
  BoardMembersPage,
  BoardOverviewPage,
  BoardSessionCreatePage,
  BoardSessionLivePage,
  BoardSessionsListPage,
  BoardSessionsPage,
} from '@/features/board';
import {
  DistributionPage,
  InvestigationCreatePage,
  InvestigationDetailPage,
  InvestigationsCasesPage,
  InvestigationsLayout,
  IncomingPage,
  OutgoingLettersPage,
  OutgoingPage,
} from '@/features/investigations';
import {
  MedicalCertificatePage,
  MedicalLayout,
  MedicalOverviewPage,
  MedicalQueuePage,
  MedicalResultsPage,
  StationExamPage,
} from '@/features/medical';
import {
  BarcodeBatchPage,
  BarcodeGeneratePage,
  BarcodeLayout,
  BarcodeLookupPage,
  BarcodeReplacementPage,
  BarcodeScannerPage,
  BarcodeScansHistoryPage,
} from '@/features/barcode';
import {
  BiometricEnrollPage,
  BiometricHistoryPage,
  BiometricLayout,
  BiometricMonitoringPage,
  BiometricVerifyOpsPage,
  BiometricVerifyPage,
} from '@/features/biometric';
import {
  ExamCreatePage,
  ExamDetailPage,
  ExamsLayout,
  ExamsListPage,
  ExamsListPageNew,
  ExamsResultsPage,
  LiveExamPage,
  ProctorListPage,
  ProctorViewPage,
  QuestionBankCRUDPage,
  QuestionBankPage,
} from '@/features/exams';
import {
  ApplicantGradesChangesPage,
  ApplicantGradesImportPage,
  ApplicantGradesPage,
} from '@/features/applicant-grades';

/**
 * AdminIndexRoute — every admin role lands on the admissions command
 * center (/admin/reports). The legacy DashboardPage is no longer the
 * default index for any role.
 */
function AdminIndexRoute(): JSX.Element {
  return <Navigate to={ROUTES.admin.reports} replace />;
}

/**
 * HubIndexRoute — every authenticated officer (and the applicant escape
 * hatch) gets the hub. super_admin used to be bounced to /admin/reports
 * here, but that broke their primary path back to other apps once they
 * landed on the command center. Initial-landing is now handled by
 * LoginForm's onSuccess + DemoBootstrapRedirect, not by this route.
 */
function HubIndexRoute(): JSX.Element {
  return <HubPage />;
}

/**
 * Back-compat redirect for the legacy `/committee/:id` detail URLs.
 * Forwards the `:id` segment to the new `/admin/committee/:id` route.
 */
function LegacyCommitteeDetailRedirect(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/admin/committee/${id ?? ''}`} replace />;
}

export const routes: RouteObject[] = [
  /* ── PUBLIC SURFACE — no auth required ───────────────────── */
  { path: '/', element: <PublicLandingPage /> },
  { path: '/staff-login', element: <LoginPage /> },
  { path: '/applicant-login', element: <ApplicantLoginPage /> },
  { path: '/login', element: <Navigate to="/staff-login" replace /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/help', element: <HelpPage /> },

  /* ── STAFF SURFACE — AuthGuard required ─────────────────── */
  { path: '/hub', element: <AuthGuard><HubIndexRoute /></AuthGuard> },
  {
    path: '/architecture',
    element: <AuthGuard app="architecture"><ArchitecturePage /></AuthGuard>,
  },
  {
    path: '/design-revamp',
    element: <AuthGuard app="architecture"><RevampComparisonPage /></AuthGuard>,
  },
  { path: '/profile', element: <AuthGuard><ProfilePage /></AuthGuard> },

  {
    path: '/admin',
    element: <AuthGuard app="admin"><AdminLayout /></AuthGuard>,
    children: [
      { index: true, element: <AdminIndexRoute /> },
      { path: 'applicants', element: <ApplicantsPage /> },
      { path: 'applicants/new', element: <ApplicantNewPage /> },
      { path: 'applicants/:id', element: <ApplicantDetailPage /> },
      { path: 'applicants/:id/edit', element: <ApplicantEditPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/new', element: <UserCreatePage /> },
      { path: 'users/roles', element: <RolesPage /> },
      { path: 'users/:id', element: <UserDetailPage /> },
      { path: 'users/:id/edit', element: <UserEditPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      /* Lookup Management Module — /admin/reference-data redirects here. */
      { path: 'lookups', element: <LookupsHubPage /> },
      /* Detail view registered before the catch-all `lookups/:tab` so
       * `/admin/lookups/applicant-categories/officers_general` resolves to
       * the read-only detail page rather than the tab panel. */
      {
        path: 'lookups/applicant-categories/:id',
        element: <ApplicantCategoryDetailPage />,
      },
      /* `submission-types` was folded into `applicant-categories` as an
       * attribute (each category's metadata.submissionTypeCode resolves
       * its gradingMode). The legacy tab URL bounces to the new home. */
      {
        path: 'lookups/submission-types',
        element: <Navigate to="/admin/lookups/applicant-categories" replace />,
      },
      { path: 'lookups/:tab', element: <LookupsHubPage /> },
      { path: 'reference-data', element: <Navigate to="/admin/lookups" replace /> },
      { path: 'reference-data/:tab', element: <Navigate to="/admin/lookups/:tab" replace /> },
      { path: 'categories', element: <CategoriesListPage /> },
      /* `/new` retired — the RFP category set is locked to 4 entries.
       * Anyone hitting the legacy URL bounces back to the list. */
      { path: 'categories/new', element: <Navigate to="/admin/categories" replace /> },
      { path: 'categories/:key', element: <CategoryEditPage /> },
      { path: 'cycles', element: <CyclesPage /> },
      { path: 'cycles/new', element: <CycleNewPage /> },
      { path: 'cycles/:id', element: <CycleDetailPage /> },
      { path: 'cycles/:id/edit', element: <CycleEditPage /> },
      /* Committee instances management — cross-cycle list + inline edit
       * for date + capacity. Reads the same record set the wizard step
       * (cycles/admission-setup/wizard/committees) authors. */
      { path: 'committees-exam-config', element: <CommitteeInstancesPage /> },
      /* Legacy redirect — `/admin/committees` renamed during the
       * committees-exam-config rework. External bookmarks land here. */
      { path: 'committees', element: <Navigate to="/admin/committees-exam-config" replace /> },
      { path: 'workflows', element: <WorkflowsListPage /> },
      { path: 'workflows/new', element: <WorkflowEditorPage /> },
      { path: 'workflows/:id', element: <WorkflowEditorPage /> },
      { path: 'applicant-grades', element: <ApplicantGradesPage /> },
      { path: 'applicant-grades/import', element: <ApplicantGradesImportPage /> },
      { path: 'applicant-grades/changes', element: <ApplicantGradesChangesPage /> },
      /* Admission Setup — config-driven ordered steps. The route segments
       * mirror `routeSegment` from `ADMISSION_SETUP_STEPS`; adding a new
       * step is a config-entry append plus a route line here. AuthGuard +
       * `app="admin"` from the parent route already gate access; the
       * permission check (`admission-setup:read`) is enforced inside the
       * pages so an admin without the permission lands on a calm empty
       * state instead of a redirect. */
      { path: 'cycles/admission-setup', element: <AdmissionSetupIndexPage /> },
      /* Wizard route — single page that orchestrates all setup steps as
       * a top-stepper flow. `:stepKey` is one of `AdmissionSetupStepKey`
       * or the literal `'review'` (handled inside the page). */
      { path: 'cycles/admission-setup/wizard', element: <Navigate to={ROUTES.admin.admissionSetup.wizard('application_settings')} replace /> },
      { path: 'cycles/admission-setup/wizard/:stepKey', element: <AdmissionSetupWizardPage /> },
      { path: 'cycles/admission-setup/application-settings', element: <ApplicationSettingsPage /> },
      { path: 'cycles/admission-setup/application-settings-review', element: <ApplicationSettingsReviewPage /> },
      { path: 'cycles/admission-setup/application-status', element: <ApplicationStatusPage /> },
      { path: 'cycles/admission-setup/fees', element: <AdmissionFeesPage /> },
      { path: 'cycles/admission-setup/exams', element: <ExamsManagementPage /> },
      { path: 'cycles/admission-setup/committees', element: <CommitteesManagementPage /> },
      { path: 'cycles/admission-setup/electronic-declaration', element: <ElectronicDeclarationPage /> },
      /* Legacy redirects — old paths used to live at /admin/admission-setup/*. */
      { path: 'admission-setup', element: <Navigate to={ROUTES.admin.admissionSetup.index} replace /> },
      { path: 'admission-setup/*', element: <Navigate to={ROUTES.admin.admissionSetup.index} replace /> },
    ],
  },

  /* ── APPLICANT SURFACE — Stage 1+2 IS the auth ──────────── */
  {
    /* Pre-wizard public-ish pages share a slim layout (logo + back-to-hub
     * nav) so users always have a way out. The 11-stage wizard below has
     * its own ApplicantPortalLayout. */
    element: <AuthGuard app="applicant"><ApplicantPreWizardLayout /></AuthGuard>,
    children: [
      { path: '/applicant/start', element: <CategorySelectionPage /> },
      { path: '/applicant/eligibility', element: <EligibilityCheckPage /> },
      { path: '/applicant/tests', element: <TestScheduleAndResultsPage /> },
      { path: '/applicant/ineligible', element: <ApplicantIneligiblePage /> },
    ],
  },
  {
    path: '/applicant',
    element: <AuthGuard app="applicant"><ApplicantPortalLayout /></AuthGuard>,
    children: [
      { index: true, element: <ApplicantPortalPage /> },
      /* `/applicant/auth/step-{1,2}` are gone — MOI portal handles auth
       * upstream. Legacy URLs redirect to the post-MOI profile entry. */
      { path: 'auth/step-1', element: <Navigate to="/applicant/profile" replace /> },
      { path: 'auth/step-2', element: <Navigate to="/applicant/profile" replace /> },
      /* MOI-aligned: legacy `/applicant/profile/{personal,education}` paths
       * redirect to the collapsed single-page form. `marital` redirects to
       * the family page where marital data now lives. */
      { path: 'profile', element: <Stage345ApplicantDataPage /> },
      { path: 'profile/personal', element: <Navigate to="/applicant/profile" replace /> },
      { path: 'profile/education', element: <Navigate to="/applicant/profile" replace /> },
      { path: 'profile/marital', element: <Navigate to="/applicant/profile/family" replace /> },
      /* `/applicant/verify` was dropped — MOI integration carries the
       * verified identity from the portal handoff, so the re-verify
       * screen became redundant. Redirect to the summary for any
       * deep-links that still point at the old URL. */
      { path: 'verify', element: <Navigate to="/applicant" replace /> },
      { path: 'payment', element: <Stage6PaymentPage /> },
      { path: 'profile/family', element: <Stage7FamilyPage /> },
      { path: 'profile/family-review', element: <Stage7ReviewFamilyPage /> },
      { path: 'exam-schedule', element: <Stage8ExamSchedulePage /> },
      { path: 'print-card', element: <Stage9PrintCardPage /> },
      { path: 'follow-up', element: <Stage10FollowUpPage /> },
      { path: 'acquaintance-doc', element: <Stage11AcquaintanceDocPage /> },
      { path: 'application/summary', element: <ApplicationSummaryPage /> },
    ],
  },

  /* ── STAFF INTERNAL APPS ─────────────────────────────────── */
  /**
   * Committees now live under /admin/committee/* so they render inside
   * AdminLayout chrome (matching the "لجان القبول" sidebar section in
   * AdminLayout.tsx). Kept as a sibling block — not a child of /admin —
   * so the AuthGuard can stay `app="committee"`: committee_user has
   * `committee` but not `admin`, and we don't want to lock them out.
   */
  {
    path: '/admin/committee',
    element: <AuthGuard app="committee"><AdminLayout /></AuthGuard>,
    children: [
      { index: true, element: <CommitteeOverviewPage /> },
      { path: 'schedule', element: <CommitteeSchedulePage /> },
      { path: 'create', element: <CommitteeCreatePage /> },
      { path: ':id', element: <CommitteeDetailPage /> },
      { path: ':id/edit', element: <CommitteeEditPage /> },
      { path: ':id/applicants', element: <CommitteeApplicantsPage /> },
    ],
  },
  /* Back-compat: old /committee/* URLs land users on the new paths. */
  { path: '/committee', element: <Navigate to="/admin/committee" replace /> },
  { path: '/committee/schedule', element: <Navigate to="/admin/committee/schedule" replace /> },
  { path: '/committee/create', element: <Navigate to="/admin/committee/create" replace /> },
  { path: '/committee/:id', element: <LegacyCommitteeDetailRedirect /> },

  {
    path: '/board',
    element: <AuthGuard app="board"><BoardLayout /></AuthGuard>,
    children: [
      { index: true, element: <BoardOverviewPage /> },
      { path: 'sessions', element: <BoardSessionsListPage /> },
      { path: 'sessions/create', element: <BoardSessionCreatePage /> },
      { path: 'sessions/:id/live', element: <BoardSessionLivePage /> },
      { path: 'sessions-legacy', element: <BoardSessionsPage /> },
      { path: 'decisions', element: <BoardDecisionsListPage /> },
      { path: 'decisions-legacy', element: <BoardDecisionsPage /> },
      { path: 'members', element: <BoardMembersPage /> },
    ],
  },

  {
    path: '/investigations',
    element: <AuthGuard app="investigations"><InvestigationsLayout /></AuthGuard>,
    children: [
      { index: true, element: <InvestigationsCasesPage /> },
      { path: 'incoming', element: <IncomingPage /> },
      { path: 'outgoing', element: <OutgoingLettersPage /> },
      { path: 'incoming-legacy', element: <OutgoingPage /> },
      { path: 'create', element: <InvestigationCreatePage /> },
      { path: 'cases/:id', element: <InvestigationDetailPage /> },
      { path: 'distribution', element: <DistributionPage /> },
    ],
  },

  {
    path: '/medical',
    element: <AuthGuard app="medical"><MedicalLayout /></AuthGuard>,
    children: [
      { index: true, element: <MedicalOverviewPage /> },
      { path: 'queue', element: <MedicalQueuePage /> },
      { path: 'results', element: <MedicalResultsPage /> },
      { path: 'station/:station', element: <StationExamPage /> },
      { path: 'certificate', element: <MedicalCertificatePage /> },
    ],
  },

  {
    path: '/barcode',
    element: <AuthGuard app="barcode"><BarcodeLayout /></AuthGuard>,
    children: [
      { index: true, element: <BarcodeGeneratePage /> },
      { path: 'lookup', element: <BarcodeLookupPage /> },
      { path: 'batch', element: <BarcodeBatchPage /> },
      { path: 'scan', element: <BarcodeScannerPage /> },
      { path: 'replace', element: <BarcodeReplacementPage /> },
      { path: 'scans', element: <BarcodeScansHistoryPage /> },
    ],
  },

  {
    path: '/biometric',
    element: <AuthGuard app="biometric"><BiometricLayout /></AuthGuard>,
    children: [
      { index: true, element: <BiometricVerifyPage /> },
      { path: 'enroll', element: <BiometricEnrollPage /> },
      { path: 'history', element: <BiometricHistoryPage /> },
      { path: 'verify-ops', element: <BiometricVerifyOpsPage /> },
      { path: 'monitoring', element: <BiometricMonitoringPage /> },
    ],
  },

  {
    path: '/question-bank',
    element: <AuthGuard app="exams"><ExamsLayout /></AuthGuard>,
    children: [
      { index: true, element: <QuestionBankPage /> },
      { path: 'manage', element: <QuestionBankCRUDPage /> },
      { path: 'exams', element: <ExamsListPageNew /> },
      { path: 'exams-legacy', element: <ExamsListPage /> },
      { path: 'exams/create', element: <ExamCreatePage /> },
      { path: 'exams/:examId', element: <ExamDetailPage /> },
      { path: 'exams/:examId/take', element: <LiveExamPage /> },
      { path: 'exams/:examId/proctor', element: <ProctorViewPage /> },
      { path: 'proctor', element: <ProctorListPage /> },
      { path: 'results', element: <ExamsResultsPage /> },
    ],
  },

  /* ── DEV-ONLY ROUTES ──────────────────────────────────────
     Spread under a Vite-time gate. `import.meta.env.DEV` is statically
     replaced with `true` (dev) or `false` (prod), so the production bundle
     tree-shakes this branch entirely and the route is unreachable. */
  ...(import.meta.env.DEV
    ? ([
        { path: '/_dev/primitives', element: <PrimitivesReviewPage /> },
        { path: '/_dev/lookups', element: <LookupsReviewPage /> },
        { path: '/_dev/app-settings', element: <AppSettingsReviewPage /> },
        { path: '/_dev/applicant-grades-import', element: <ApplicantGradesImportReviewPage /> },
      ] satisfies RouteObject[])
    : []),

  /* ── 404 FALLBACK → public landing ───────────────────────── */
  { path: '*', element: <Navigate to="/" replace /> },
];
