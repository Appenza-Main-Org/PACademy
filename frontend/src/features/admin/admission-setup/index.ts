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

/* Embeddable variants — for hosting inside a Drawer/Modal from a parent
 * route (e.g. /admin/cycles "إعداد القبول") without forcing navigation. */
export { EmbeddedAdmissionSetupWizard } from './components/EmbeddedAdmissionSetupWizard';
export { ApplicationSettingsPage } from './pages/ApplicationSettingsPage';
export { ApplicationSettingsReviewPage } from './pages/ApplicationSettingsReviewPage';
export { ApplicationStatusPage } from './pages/ApplicationStatusPage';
/* AgeRulesPage removed 2026-05; MaritalStatusRulesPage removed when
 * MARITAL_STATUSES dropped out of the lookup catalogue. */
export { FeesPage as AdmissionFeesPage } from './pages/FeesPage';
export { ExamsManagementPage } from './pages/ExamsManagementPage';
export { CommitteesManagementPage } from './pages/CommitteesManagementPage';
export { ElectronicDeclarationPage } from './pages/ElectronicDeclarationPage';

/* Embeddable add-form used by both the wizard committees step and the
 * `/admin/committees-exam-config` management page so admins can author
 * new (committee × date) rows from either surface. */
export { CommitteeInstanceAddForm } from './components/committeeBinding/CommitteeInstanceAddForm';
export { useActiveCategoriesForCycle } from './lib/activeCategories';
export type { ActiveCategoryView } from './lib/activeCategories';
