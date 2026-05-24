import { ROOT_PATH_BY_APP, ROUTES } from '@/config/routes';
import type { AppKey } from '@/shared/lib/constants';
import { hasPermission } from '../rbac';
import type { AuthUser } from '../types';

const STAFF_APP_PRIORITY: readonly AppKey[] = [
  'admin',
  'committee',
  'medical',
  'exams',
  'board',
  'investigations',
  'barcode',
  'biometric',
  'architecture',
];

export function getDefaultRouteForUser(user: AuthUser): string {
  if (user.role === 'applicant') return ROUTES.applicant;

  if (user.apps.includes('admin')) {
    if (hasPermission(user.permissions, 'reports:view')) return ROUTES.admin.reports;
    if (hasPermission(user.permissions, 'cycles:view')) return ROUTES.admin.cycles;
    if (hasPermission(user.permissions, 'lookups:view')) {
      return ROUTES.admin.adminLookupsType('applicant-categories');
    }
    return ROUTES.admin.dashboard;
  }

  const firstAllowedApp = STAFF_APP_PRIORITY.find((app) => user.apps.includes(app));
  return firstAllowedApp ? ROOT_PATH_BY_APP[firstAllowedApp] : ROUTES.staffLogin;
}
