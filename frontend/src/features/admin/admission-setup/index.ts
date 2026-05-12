/**
 * Admission Setup feature barrel.
 *
 * Public surface consumed by `routes.tsx`, `Sidebar.tsx`, and the admin
 * feature index. Internal components / services / hooks remain private —
 * import them through this barrel only.
 */

export {
  ADMISSION_SETUP_STEPS,
  ADMISSION_SETUP_TOTAL_STEPS,
  ADMISSION_SETUP_CYCLE_STORAGE_KEY,
  getStepByKey,
  getStepByPath,
} from './config';
export type { AdmissionSetupStep } from './config';
export type { AdmissionSetupStepKey, AdmissionSetupStepStatus } from './types';

/* Pages */
export { AdmissionSetupIndexPage } from './pages/AdmissionSetupIndexPage';
export { AdmissionSetupWizardPage } from './pages/AdmissionSetupWizardPage';
export { ApplicationSettingsPage } from './pages/ApplicationSettingsPage';
export { ApplicationStatusPage } from './pages/ApplicationStatusPage';
export { AgeRulesPage } from './pages/AgeRulesPage';
/* MaritalStatusRulesPage removed when MARITAL_STATUSES dropped out of
 * the lookup catalogue. */
export { FeesPage as AdmissionFeesPage } from './pages/FeesPage';
export { ExamsManagementPage } from './pages/ExamsManagementPage';
export { CommitteesManagementPage } from './pages/CommitteesManagementPage';
export { ExamDatesPage } from './pages/ExamDatesPage';
export { NotificationsStepPage } from './pages/NotificationsStepPage';
export { ElectronicDeclarationPage } from './pages/ElectronicDeclarationPage';
