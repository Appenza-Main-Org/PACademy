/**
 * Route registry — every route in the app maps here.
 * Keep this file thin: it composes page components + AuthGuard, nothing else.
 */

import { Navigate, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@/app/providers/AuthGuard';
import { LoginPage } from '@/features/auth';
import { HubPage } from '@/features/hub';
import { ArchitecturePage } from '@/features/architecture';
import {
  ApplicantPortalLayout,
  ApplicantPortalPage,
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
} from '@/features/applicant-portal';
import {
  AdminLayout,
  AdmissionRulesPage,
  ApplicantDetailPage,
  ApplicantsPage,
  AuditPage,
  CycleDetailPage,
  CyclesPage,
  DashboardPage,
  ReferenceDataPage,
  ReportsPage,
  SettingsPage,
  UsersPage,
} from '@/features/admin';
import {
  CommitteeCreatePage,
  CommitteeDetailPage,
  CommitteeLayout,
  CommitteeListPage,
  CommitteeOverviewPage,
  CommitteeSchedulePage,
} from '@/features/committees';
import { BoardLayout, BoardOverviewPage, BoardSessionsPage, BoardDecisionsPage } from '@/features/board';
import { InvestigationsLayout, InvestigationsCasesPage, IncomingPage, OutgoingPage } from '@/features/investigations';
import { MedicalLayout, MedicalOverviewPage, MedicalQueuePage, MedicalResultsPage } from '@/features/medical';
import { BarcodeLayout, BarcodeGeneratePage, BarcodeLookupPage, BarcodeBatchPage } from '@/features/barcode';
import { BiometricLayout, BiometricVerifyPage, BiometricEnrollPage, BiometricHistoryPage } from '@/features/biometric';
import { ExamsLayout, QuestionBankPage, ExamsListPage, ExamsResultsPage } from '@/features/exams';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },

  { path: '/', element: <AuthGuard><HubPage /></AuthGuard> },

  {
    path: '/architecture',
    element: <AuthGuard><ArchitecturePage /></AuthGuard>,
  },

  {
    path: '/admin',
    element: <AuthGuard app="admin"><AdminLayout /></AuthGuard>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'applicants', element: <ApplicantsPage /> },
      { path: 'applicants/:id', element: <ApplicantDetailPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reference-data', element: <ReferenceDataPage /> },
      { path: 'reference-data/:tab', element: <ReferenceDataPage /> },
      { path: 'admission-rules', element: <AdmissionRulesPage /> },
      { path: 'cycles', element: <CyclesPage /> },
      { path: 'cycles/:id', element: <CycleDetailPage /> },
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
    ],
  },

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
      { path: 'sessions', element: <BoardSessionsPage /> },
      { path: 'decisions', element: <BoardDecisionsPage /> },
    ],
  },

  {
    path: '/investigations',
    element: <AuthGuard app="investigations"><InvestigationsLayout /></AuthGuard>,
    children: [
      { index: true, element: <InvestigationsCasesPage /> },
      { path: 'incoming', element: <IncomingPage /> },
      { path: 'outgoing', element: <OutgoingPage /> },
    ],
  },

  {
    path: '/medical',
    element: <AuthGuard app="medical"><MedicalLayout /></AuthGuard>,
    children: [
      { index: true, element: <MedicalOverviewPage /> },
      { path: 'queue', element: <MedicalQueuePage /> },
      { path: 'results', element: <MedicalResultsPage /> },
    ],
  },

  {
    path: '/barcode',
    element: <AuthGuard app="barcode"><BarcodeLayout /></AuthGuard>,
    children: [
      { index: true, element: <BarcodeGeneratePage /> },
      { path: 'lookup', element: <BarcodeLookupPage /> },
      { path: 'batch', element: <BarcodeBatchPage /> },
    ],
  },

  {
    path: '/biometric',
    element: <AuthGuard app="biometric"><BiometricLayout /></AuthGuard>,
    children: [
      { index: true, element: <BiometricVerifyPage /> },
      { path: 'enroll', element: <BiometricEnrollPage /> },
      { path: 'history', element: <BiometricHistoryPage /> },
    ],
  },

  {
    path: '/question-bank',
    element: <AuthGuard app="exams"><ExamsLayout /></AuthGuard>,
    children: [
      { index: true, element: <QuestionBankPage /> },
      { path: 'exams', element: <ExamsListPage /> },
      { path: 'results', element: <ExamsResultsPage /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
];
