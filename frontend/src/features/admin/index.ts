export { AdminLayout } from './AdminLayout';
export { DashboardPage } from './pages/DashboardPage';
export { ApplicantsPage } from './pages/ApplicantsPage';
export { ApplicantDetailPage } from './pages/ApplicantDetailPage';
export { ApplicantNewPage } from './pages/ApplicantNewPage';
export { ApplicantEditPage } from './pages/ApplicantEditPage';
export { UsersPage } from './pages/UsersPage';
export { UserCreatePage } from './pages/users/UserCreatePage';
export { UserDetailPage } from './pages/users/UserDetailPage';
export { UserEditPage } from './pages/users/UserEditPage';
export { RolesPage } from './pages/RolesPage';
export { NotificationsPage } from './pages/NotificationsPage';
export { PaymentsPage } from './pages/PaymentsPage';
export { AuditPage } from './pages/AuditPage';
export { ActiveCycleIndicator } from './components/cycles/ActiveCycleIndicator';

/* Cross-feature exports (admin services consumed by applicant-portal etc.) */
export {
  useApplicantNotifications,
  useAdminNotifications,
  useCreateAdminNotification,
  usePublishNotification,
  useUnpublishNotification,
} from './api/notifications.queries';
export { SettingsPage } from './pages/SettingsPage';
export { ReportsPage } from './pages/ReportsPage';
/* ReferenceDataPage removed — superseded by `/admin/lookups`
 * (features/lookups/pages/LookupsHubPage). */
export { CyclesPage } from './pages/CyclesPage';
export { CycleDetailPage } from './pages/CycleDetailPage';
export { CycleEditPage } from './pages/CycleEditPage';

/* Post-polish admin pages — Buckets D and E */
export { CategoriesListPage } from './pages/CategoriesListPage';
export { CategoryEditPage } from './pages/CategoryEditPage';
export { CycleNewPage } from './pages/CycleNewPage';

/* Post-polish admin pages — Department Workflow Builder (RFP §3 / §6) */
export { WorkflowsListPage } from './pages/WorkflowsListPage';
export { WorkflowEditorPage } from './pages/WorkflowEditorPage';

/* Admission Setup section — config-driven setup wizard. */
export {
  ADMISSION_SETUP_STEPS,
  ADMISSION_SETUP_TOTAL_STEPS,
  AdmissionSetupIndexPage,
  AdmissionSetupWizardPage,
  ApplicationSettingsPage,
  ApplicationSettingsReviewPage,
  ApplicationStatusPage,
  AdmissionFeesPage,
  ExamsManagementPage,
  CommitteesManagementPage,
  ElectronicDeclarationPage,
} from './admission-setup';
export type { AdmissionSetupStep, AdmissionSetupStepKey } from './admission-setup';
