/**
 * Route registry — every route in the app maps here.
 * Keep this file thin: it composes page components + AuthGuard, nothing else.
 */

import { Navigate, type RouteObject } from 'react-router-dom';
import { AuthGuard } from '@/app/providers/AuthGuard';
import { LoginPage } from '@/features/auth';
import { HubPage } from '@/features/hub';
import { ArchitecturePage } from '@/features/architecture';
import { ApplicantPortalPage } from '@/features/applicant-portal';
import {
  AdminLayout,
  DashboardPage,
  ApplicantsPage,
  ApplicantDetailPage,
  UsersPage,
  AuditPage,
  SettingsPage,
  ReportsPage,
} from '@/features/admin';
import {
  CommitteeLayout,
  CommitteeOverviewPage,
  CommitteeListPage,
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
    ],
  },

  {
    path: '/applicant',
    element: <AuthGuard app="applicant"><ApplicantPortalPage /></AuthGuard>,
  },

  {
    path: '/committee',
    element: <AuthGuard app="committee"><CommitteeLayout /></AuthGuard>,
    children: [
      { index: true, element: <CommitteeOverviewPage /> },
      { path: 'list', element: <CommitteeListPage /> },
      { path: 'schedule', element: <CommitteeSchedulePage /> },
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
