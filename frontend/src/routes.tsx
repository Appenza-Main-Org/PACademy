/**
 * Route registry — every route in the app maps here.
 * Source: ARCH-04 (public/private split).
 *
 * Three surfaces:
 *  - PUBLIC (no auth)   → /, /applicant-login, /staff-login
 *  - APPLICANT (Stage1+2 auth) → /applicant/*
 *  - STAFF (AuthGuard)  → /admin/*, /committee/*, /board/*, /investigations/*,
 *                         /medical/*, /barcode/*, /biometric/*, /question-bank/*,
 *                         /architecture, /profile
 */

import { Navigate, useParams, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@/app/providers/AuthGuard';
import { getDefaultRouteForUser, LoginPage, ApplicantLoginPage, useAuthStore } from '@/features/auth';
import { ROUTES } from '@/config/routes';
import { ArchitecturePage } from '@/features/architecture';
import { RevampComparisonPage } from '@/features/design-revamp';
import { ProfilePage } from '@/features/profile';
import { PublicLandingPage } from '@/features/landing';
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
  AdmissionRulesPage,
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
  CycleDetailPage,
  CycleEditPage,
  CycleNewPage,
  CyclesPage,
  DashboardPage,
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
  BiometricIdentityVerifyPage,
  BiometricLayout,
  BiometricMonitoringPage,
  BiometricVerifyOpsPage,
  BiometricVerifyPage,
} from '@/features/biometric';
import {
  ExamCreatePage,
  ExamDetailPage,
  ExamPreviewPage,
  ExamsLayout,
  ExamsListPage,
  ExamsListPageNew,
  ExamsResultsPage,
  LiveExamPage,
  ProctorListPage,
  ProctorViewPage,
  QuestionBankCRUDPage,
  QuestionBankPage,
  TakeExamEntryPage,
} from '@/features/exams';
import {
  ApplicantGradesChangesPage,
  ApplicantGradesImportHistoryPage,
  ApplicantGradesImportPage,
  ApplicantGradesPage,
} from '@/features/applicant-grades';
import { DataExchangePage } from '@/features/data-exchange';

/**
 * AdminIndexRoute — every admin role lands on the live admissions dashboard.
 */
function AdminIndexRoute(): JSX.Element {
  return <DashboardPage />;
}

function LegacyHubRedirect(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={user ? getDefaultRouteForUser(user) : ROUTES.staffLogin} replace />;
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
  { path: '/terms', element: <Navigate to="/" replace /> },
  { path: '/help', element: <Navigate to="/" replace /> },

  /* ── STAFF SURFACE — AuthGuard required ─────────────────── */
  { path: '/hub', element: <AuthGuard><LegacyHubRedirect /></AuthGuard> },
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
      { path: 'applicants', element: <AuthGuard app="admin" perm="applicants:view"><ApplicantsPage /></AuthGuard> },
      { path: 'applicants/new', element: <AuthGuard app="admin" perm="applicants:create"><ApplicantNewPage /></AuthGuard> },
      { path: 'applicants/:id', element: <AuthGuard app="admin" perm="applicants:view"><ApplicantDetailPage /></AuthGuard> },
      { path: 'applicants/:id/edit', element: <AuthGuard app="admin" perm="applicants:edit"><ApplicantEditPage /></AuthGuard> },
      { path: 'users', element: <AuthGuard app="admin" perm="users:view"><UsersPage /></AuthGuard> },
      { path: 'users/new', element: <AuthGuard app="admin" perm="users:create"><UserCreatePage /></AuthGuard> },
      { path: 'users/roles', element: <AuthGuard app="admin" perm="roles:manage"><RolesPage /></AuthGuard> },
      { path: 'users/:id', element: <AuthGuard app="admin" perm="users:view"><UserDetailPage /></AuthGuard> },
      { path: 'users/:id/edit', element: <AuthGuard app="admin" perm="users:edit"><UserEditPage /></AuthGuard> },
      { path: 'notifications', element: <AuthGuard app="admin" perm="notifications:view"><NotificationsPage /></AuthGuard> },
      { path: 'payments', element: <AuthGuard app="admin" perm="payments:review"><PaymentsPage /></AuthGuard> },
      { path: 'audit', element: <AuthGuard app="admin" perm="audit:view"><AuditPage /></AuthGuard> },
      { path: 'settings', element: <AuthGuard app="admin" perm="settings:manage"><SettingsPage /></AuthGuard> },
      { path: 'reports', element: <AuthGuard app="admin" perm="reports:view"><ReportsPage /></AuthGuard> },
      /* Lookup Management Module — /admin/reference-data redirects here. */
      { path: 'lookups', element: <AuthGuard app="admin" perm="lookups:view"><LookupsHubPage /></AuthGuard> },
      /* Detail view registered before the catch-all `lookups/:tab` so
       * `/admin/lookups/applicant-categories/officers_general` resolves to
       * the read-only detail page rather than the tab panel. */
      {
        path: 'lookups/applicant-categories/:id',
        element: <AuthGuard app="admin" perm="lookups:view"><ApplicantCategoryDetailPage /></AuthGuard>,
      },
      /* `submission-types` was folded into `applicant-categories` as an
       * attribute (each category's metadata.submissionTypeCode resolves
       * its gradingMode). The legacy tab URL bounces to the new home. */
      {
        path: 'lookups/submission-types',
        element: <Navigate to="/admin/lookups/applicant-categories" replace />,
      },
      {
        path: 'lookups/mappings/:kind',
        element: <Navigate to="/admin/lookups" replace />,
      },
      { path: 'lookups/:tab', element: <AuthGuard app="admin" perm="lookups:view"><LookupsHubPage /></AuthGuard> },
      { path: 'reference-data', element: <Navigate to="/admin/lookups" replace /> },
      { path: 'reference-data/:tab', element: <Navigate to="/admin/lookups/:tab" replace /> },
      { path: 'categories', element: <AuthGuard app="admin" perm="categories:view"><CategoriesListPage /></AuthGuard> },
      /* `/new` retired — the RFP category set is locked to 4 entries.
       * Anyone hitting the legacy URL bounces back to the list. */
      { path: 'categories/new', element: <Navigate to="/admin/categories" replace /> },
      { path: 'categories/:key', element: <AuthGuard app="admin" perm="categories:edit"><CategoryEditPage /></AuthGuard> },
      { path: 'cycles', element: <AuthGuard app="admin" perm="cycles:view"><CyclesPage /></AuthGuard> },
      { path: 'cycles/new', element: <AuthGuard app="admin" perm="cycles:create"><CycleNewPage /></AuthGuard> },
      { path: 'cycles/:id', element: <AuthGuard app="admin" perm="cycles:view"><CycleDetailPage /></AuthGuard> },
      { path: 'cycles/:id/edit', element: <AuthGuard app="admin" perm="cycles:edit"><CycleEditPage /></AuthGuard> },
      /* Committee instances management — active-cycle list + inline edit
       * for date + capacity. This is the canonical committees scheduling
       * surface; the admission-setup wizard no longer embeds it. */
      { path: 'committees-exam-config', element: <AuthGuard app="admin" perm="committees-exam-config:view"><CommitteeInstancesPage /></AuthGuard> },
      /* Legacy redirect — `/admin/committees` renamed during the
       * committees-exam-config rework. External bookmarks land here. */
      { path: 'committees', element: <Navigate to="/admin/committees-exam-config" replace /> },
      { path: 'workflows', element: <AuthGuard app="admin" perm="workflows:view"><WorkflowsListPage /></AuthGuard> },
      { path: 'workflows/new', element: <AuthGuard app="admin" perm="workflows:create"><WorkflowEditorPage /></AuthGuard> },
      { path: 'workflows/:id', element: <AuthGuard app="admin" perm="workflows:edit"><WorkflowEditorPage /></AuthGuard> },
      { path: 'applicant-grades', element: <AuthGuard app="admin" perm="applicant-grades:view"><ApplicantGradesPage /></AuthGuard> },
      { path: 'data-exchange', element: <AuthGuard app="admin" perm="data-exchange:view"><DataExchangePage /></AuthGuard> },
      { path: 'applicant-grades/import', element: <AuthGuard app="admin" perm="applicant-grades:import"><ApplicantGradesImportPage /></AuthGuard> },
      { path: 'applicant-grades/import-history', element: <AuthGuard app="admin" perm="applicant-grades:view"><ApplicantGradesImportHistoryPage /></AuthGuard> },
      { path: 'applicant-grades/changes', element: <AuthGuard app="admin" perm="applicant-grades:edit"><ApplicantGradesChangesPage /></AuthGuard> },
      { path: 'admission-rules', element: <AuthGuard app="admin" perm="admission-rules:manage"><AdmissionRulesPage /></AuthGuard> },
      /* Admission Setup — config-driven ordered steps. The route segments
       * mirror `routeSegment` from `ADMISSION_SETUP_STEPS`; adding a new
       * step is a config-entry append plus a route line here. AuthGuard +
       * `app="admin"` from the parent route gate app access, while each
       * concrete step below also carries `admission-setup:read` so direct
       * URLs cannot bypass the RBAC matrix. */
      { path: 'cycles/admission-setup', element: <AuthGuard app="admin" perm="admission-setup:read"><AdmissionSetupIndexPage /></AuthGuard> },
      /* Wizard route — single page that orchestrates all setup steps as
       * a top-stepper flow. `:stepKey` is one of `AdmissionSetupStepKey`
       * or the literal `'review'` (handled inside the page). */
      { path: 'cycles/admission-setup/wizard', element: <Navigate to={ROUTES.admin.admissionSetup.wizard('application_settings')} replace /> },
      { path: 'cycles/admission-setup/wizard/:stepKey', element: <AuthGuard app="admin" perm="admission-setup:read"><AdmissionSetupWizardPage /></AuthGuard> },
      { path: 'cycles/admission-setup/application-settings', element: <AuthGuard app="admin" perm="admission-setup:read"><ApplicationSettingsPage /></AuthGuard> },
      { path: 'cycles/admission-setup/application-settings-review', element: <AuthGuard app="admin" perm="admission-setup:read"><ApplicationSettingsReviewPage /></AuthGuard> },
      { path: 'cycles/admission-setup/application-status', element: <AuthGuard app="admin" perm="admission-setup:read"><ApplicationStatusPage /></AuthGuard> },
      { path: 'cycles/admission-setup/fees', element: <AuthGuard app="admin" perm="admission-setup:read"><AdmissionFeesPage /></AuthGuard> },
      { path: 'cycles/admission-setup/exams', element: <AuthGuard app="admin" perm="admission-setup:read"><ExamsManagementPage /></AuthGuard> },
      { path: 'cycles/admission-setup/committees', element: <Navigate to="/admin/committees-exam-config" replace /> },
      { path: 'cycles/admission-setup/electronic-declaration', element: <AuthGuard app="admin" perm="admission-setup:read"><ElectronicDeclarationPage /></AuthGuard> },
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
      { path: '/applicant/eligibility', element: <Navigate to="/applicant/start" replace /> },
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
      { path: 'verify', element: <BiometricIdentityVerifyPage /> },
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
      { path: 'exams/:examId/preview', element: <ExamPreviewPage /> },
      { path: 'exams/:examId/take', element: <LiveExamPage /> },
      { path: 'exams/:examId/proctor', element: <ProctorViewPage /> },
      { path: 'take', element: <TakeExamEntryPage /> },
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
