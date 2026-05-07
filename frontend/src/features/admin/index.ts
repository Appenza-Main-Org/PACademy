export { AdminLayout } from './AdminLayout';
export { DashboardPage } from './pages/DashboardPage';
export { ApplicantsPage } from './pages/ApplicantsPage';
export { ApplicantDetailPage } from './pages/ApplicantDetailPage';
export { ApplicantNewPage } from './pages/ApplicantNewPage';
export { ApplicantEditPage } from './pages/ApplicantEditPage';
export { UsersPage } from './pages/UsersPage';
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
export { ReferenceDataPage } from './pages/ReferenceDataPage';
export { CyclesPage } from './pages/CyclesPage';
export { CycleDetailPage } from './pages/CycleDetailPage';
export { AdmissionRulesPage } from './pages/AdmissionRulesPage';

/* Post-polish admin pages — Buckets D and E */
export { CategoriesListPage } from './pages/CategoriesListPage';
export { CategoryEditPage } from './pages/CategoryEditPage';
export { CycleNewPage } from './pages/CycleNewPage';

/* Post-polish admin pages — Department Workflow Builder (RFP §3 / §6) */
export { WorkflowsListPage } from './pages/WorkflowsListPage';
export { WorkflowEditorPage } from './pages/WorkflowEditorPage';
