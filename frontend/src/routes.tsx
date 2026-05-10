/**
 * Route registry — every route in the app maps here.
 * Source: ARCH-04 (public/private split).
 *
 * Three surfaces:
 *  - PUBLIC (no auth)   → /, /apply, /staff-login, /terms, /help
 *  - APPLICANT (Stage1+2 auth) → /applicant/*
 *  - STAFF (AuthGuard)  → /hub, /admin/*, /committee/*, /board/*, /investigations/*,
 *                         /medical/*, /barcode/*, /biometric/*, /question-bank/*,
 *                         /architecture, /profile
 */

import { Navigate, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@/app/providers/AuthGuard';
import { LoginPage, useAuthStore } from '@/features/auth';
import { ROUTES } from '@/config/routes';
import { HubPage } from '@/features/hub';
import { ArchitecturePage } from '@/features/architecture';
import { RevampComparisonPage } from '@/features/design-revamp';
import { ProfilePage } from '@/features/profile';
import { HelpPage } from '@/features/help';
import { ApplyEntryPage, PublicLandingPage, TermsPage } from '@/features/landing';
import { PrimitivesReviewPage } from '@/features/dev';
import {
  ApplicantPortalLayout,
  ApplicationSummaryPage,
  ApplicantPortalPage,
  ApplicantPreWizardLayout,
  CategorySelectionPage,
  EligibilityCheckPage,
  Stage10FollowUpPage,
  Stage11AcquaintanceDocPage,
  Stage1AuthPhonePage,
  Stage2AuthSmsPage,
  Stage3PersonalPage,
  Stage4EducationPage,
  Stage5MaritalPage,
  Stage6PaymentPage,
  Stage7FamilyPage,
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
  AgeRulesPage,
  ApplicationSettingsPage,
  ApplicationStatusPage,
  AuditPage,
  CategoriesListPage,
  CategoryEditPage,
  CommitteeMergeSplitPage,
  CommitteesManagementPage,
  CycleDetailPage,
  CycleMetadataPage,
  CycleNewPage,
  CyclesPage,
  DashboardPage,
  DateCommitteeBindingPage,
  ElectronicDeclarationPage,
  ExamDatesPage,
  ExamsManagementPage,
  MaritalStatusRulesPage,
  NotificationsPage,
  NotificationsStepPage,
  PaymentsPage,
  ReferenceDataPage,
  ReportsPage,
  RolesPage,
  ScoreThresholdsPage,
  SettingsPage,
  TotalScorePage,
  UsersPage,
  UserCreatePage,
  UserDetailPage,
  UserEditPage,
  WorkflowEditorPage,
  WorkflowsListPage,
} from '@/features/admin';
import {
  CommitteeCreatePage,
  CommitteeDetailPage,
  CommitteeLayout,
  CommitteeListPage,
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

/**
 * AdminIndexRoute — super_admin sees the admissions command center
 * (/admin/reports) as their /admin landing; other admin roles see the
 * legacy DashboardPage.
 */
function AdminIndexRoute(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  if (user?.role === 'super_admin') {
    return <Navigate to={ROUTES.admin.reports} replace />;
  }
  return <DashboardPage />;
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

export const routes: RouteObject[] = [
  /* ── PUBLIC SURFACE — no auth required ───────────────────── */
  { path: '/', element: <PublicLandingPage /> },
  { path: '/apply', element: <ApplyEntryPage /> },
  { path: '/staff-login', element: <LoginPage /> },
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
      { path: 'reference-data', element: <ReferenceDataPage /> },
      { path: 'reference-data/:tab', element: <ReferenceDataPage /> },
      { path: 'admission-rules', element: <AdmissionRulesPage /> },
      { path: 'categories', element: <CategoriesListPage /> },
      { path: 'categories/:key', element: <CategoryEditPage /> },
      { path: 'cycles', element: <CyclesPage /> },
      { path: 'cycles/new', element: <CycleNewPage /> },
      { path: 'cycles/:id', element: <CycleDetailPage /> },
      { path: 'workflows', element: <WorkflowsListPage /> },
      { path: 'workflows/new', element: <WorkflowEditorPage /> },
      { path: 'workflows/:id', element: <WorkflowEditorPage /> },
      /* Admission Setup — 15 ordered config-driven steps. The route segments
       * mirror `routeSegment` from `ADMISSION_SETUP_STEPS`; adding a new
       * step is a config-entry append plus a route line here. AuthGuard +
       * `app="admin"` from the parent route already gate access; the
       * permission check (`admission-setup:read`) is enforced inside the
       * pages so an admin without the permission lands on a calm empty
       * state instead of a redirect. */
      { path: 'admission-setup', element: <AdmissionSetupIndexPage /> },
      /* Wizard route — single page that orchestrates all 15 setup steps as
       * a top-stepper flow. `:stepKey` is one of `AdmissionSetupStepKey`
       * or the literal `'review'` (handled inside the page). */
      { path: 'admission-setup/wizard', element: <Navigate to={ROUTES.admin.admissionSetup.wizard('cycle_metadata')} replace /> },
      { path: 'admission-setup/wizard/:stepKey', element: <AdmissionSetupWizardPage /> },
      { path: 'admission-setup/cycle-metadata', element: <CycleMetadataPage /> },
      { path: 'admission-setup/application-settings', element: <ApplicationSettingsPage /> },
      { path: 'admission-setup/application-status', element: <ApplicationStatusPage /> },
      { path: 'admission-setup/age-rules', element: <AgeRulesPage /> },
      { path: 'admission-setup/marital-status-rules', element: <MaritalStatusRulesPage /> },
      { path: 'admission-setup/fees', element: <AdmissionFeesPage /> },
      { path: 'admission-setup/exams', element: <ExamsManagementPage /> },
      { path: 'admission-setup/committees', element: <CommitteesManagementPage /> },
      { path: 'admission-setup/committee-merge-split', element: <CommitteeMergeSplitPage /> },
      { path: 'admission-setup/score-thresholds', element: <ScoreThresholdsPage /> },
      { path: 'admission-setup/exam-dates', element: <ExamDatesPage /> },
      { path: 'admission-setup/date-committee-binding', element: <DateCommitteeBindingPage /> },
      { path: 'admission-setup/total-score', element: <TotalScorePage /> },
      { path: 'admission-setup/notifications', element: <NotificationsStepPage /> },
      { path: 'admission-setup/electronic-declaration', element: <ElectronicDeclarationPage /> },
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
    ],
  },
  {
    path: '/applicant',
    element: <AuthGuard app="applicant"><ApplicantPortalLayout /></AuthGuard>,
    children: [
      { index: true, element: <ApplicantPortalPage /> },
      { path: 'auth/step-1', element: <Stage1AuthPhonePage /> },
      { path: 'auth/step-2', element: <Stage2AuthSmsPage /> },
      { path: 'profile/personal', element: <Stage3PersonalPage /> },
      { path: 'profile/education', element: <Stage4EducationPage /> },
      { path: 'profile/marital', element: <Stage5MaritalPage /> },
      { path: 'payment', element: <Stage6PaymentPage /> },
      { path: 'profile/family', element: <Stage7FamilyPage /> },
      { path: 'exam-schedule', element: <Stage8ExamSchedulePage /> },
      { path: 'print-card', element: <Stage9PrintCardPage /> },
      { path: 'follow-up', element: <Stage10FollowUpPage /> },
      { path: 'acquaintance-doc', element: <Stage11AcquaintanceDocPage /> },
      { path: 'application/summary', element: <ApplicationSummaryPage /> },
    ],
  },

  /* ── STAFF INTERNAL APPS ─────────────────────────────────── */
  {
    path: '/committee',
    element: <AuthGuard app="committee"><CommitteeLayout /></AuthGuard>,
    children: [
      { index: true, element: <CommitteeOverviewPage /> },
      { path: 'list', element: <CommitteeListPage /> },
      { path: 'schedule', element: <CommitteeSchedulePage /> },
      { path: 'create', element: <CommitteeCreatePage /> },
      { path: ':id', element: <CommitteeDetailPage /> },
    ],
  },

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
    ? ([{ path: '/_dev/primitives', element: <PrimitivesReviewPage /> }] satisfies RouteObject[])
    : []),

  /* ── 404 FALLBACK → public landing ───────────────────────── */
  { path: '*', element: <Navigate to="/" replace /> },
];
