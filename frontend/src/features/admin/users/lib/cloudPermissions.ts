/**
 * Cloud permission matrix — governs the two internet-facing apps only:
 * the admin app and the applicant portal. Operational on-prem modules
 * (committees, medical, investigations, board, exams, biometric, barcode,
 * workflows) deploy on the Ministry's on-prem cluster with their own
 * separate RBAC surface and are intentionally absent here.
 *
 * Closed union — must not be extended to include on-prem operational
 * modules. Those have a separate RBAC on the on-prem deployment;
 * coupling the two planes here would be an architectural regression.
 */

export type CloudSectionKey = 'admin' | 'applicant';

export type CloudModuleKey =
  | 'cycles'
  | 'application_setup'
  | 'lookups'
  | 'dashboard'
  | 'users_roles'
  | 'payments_config'
  | 'notifications'
  | 'applicants'
  | 'applicant_content'
  | 'applicant_documents'
  | 'applicant_payments';

export type CloudActionKey =
  | 'view'
  | 'edit'
  | 'create'
  | 'delete'
  | 'manage'
  | 'transition'
  | 'approve';

export interface CloudPermission {
  module: CloudModuleKey;
  action: CloudActionKey;
}

export interface CloudSection {
  key: CloudSectionKey;
  nameAr: string;
}

export const CLOUD_SECTIONS: readonly CloudSection[] = [
  { key: 'admin', nameAr: 'إدارة المنظومة' },
  { key: 'applicant', nameAr: 'بوابة المتقدمين' },
] as const;

export interface CloudModule {
  key: CloudModuleKey;
  nameAr: string;
  section: CloudSectionKey;
  /** Live route or surface this module governs. `null` for disabled rows. */
  route: string | null;
  /** Disabled rows render as non-interactive placeholders. */
  state: 'active' | 'disabled';
}

export const CLOUD_MODULES: readonly CloudModule[] = [
  { key: 'cycles',            nameAr: 'دورات القبول',             section: 'admin', route: '/admin/cycles',          state: 'active'   },
  { key: 'application_setup', nameAr: 'إعداد التقديم',             section: 'admin', route: '/admin/admission-setup', state: 'active'   },
  { key: 'lookups',           nameAr: 'الأكواد المرجعية',          section: 'admin', route: '/admin/lookups',         state: 'active'   },
  { key: 'dashboard',         nameAr: 'لوحة قيادة منظومة القبول',  section: 'admin', route: '/admin/reports',         state: 'active'   },
  { key: 'users_roles',       nameAr: 'المستخدمون والصلاحيات',     section: 'admin', route: '/admin/users',           state: 'active'   },
  { key: 'payments_config',   nameAr: 'إعدادات المدفوعات',         section: 'admin', route: null,                     state: 'disabled' },
  { key: 'notifications',     nameAr: 'إدارة الإشعارات',           section: 'admin', route: '/admin/notifications',   state: 'active'   },
  { key: 'applicants',          nameAr: 'المتقدمون',           section: 'applicant', route: '/admin/applicants', state: 'active' },
  { key: 'applicant_content',   nameAr: 'محتوى البوابة',       section: 'applicant', route: null,                state: 'active' },
  { key: 'applicant_documents', nameAr: 'مستندات المتقدمين',   section: 'applicant', route: null,                state: 'active' },
  { key: 'applicant_payments',  nameAr: 'مدفوعات المتقدمين',   section: 'applicant', route: '/admin/payments',   state: 'active' },
] as const;

export interface CloudAction {
  key: CloudActionKey;
  nameAr: string;
}

export const CLOUD_ACTIONS: readonly CloudAction[] = [
  { key: 'view',       nameAr: 'عرض' },
  { key: 'edit',       nameAr: 'تعديل' },
  { key: 'create',     nameAr: 'إنشاء' },
  { key: 'delete',     nameAr: 'حذف' },
  { key: 'manage',     nameAr: 'إدارة' },
  { key: 'transition', nameAr: 'تغيير الحالة' },
  { key: 'approve',    nameAr: 'اعتماد' },
] as const;

type RowCapabilities = Record<CloudActionKey, boolean>;

/**
 * Per-row capability map — single source of truth for which cells are
 * interactive. Disabled rows render with every cell non-interactive
 * regardless of this map.
 */
export const ROW_CAPABILITY_MAP: Record<CloudModuleKey, RowCapabilities> = {
  cycles:              { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: true  },
  application_setup:   { view: true,  edit: true,  create: false, delete: false, manage: true,  transition: false, approve: true  },
  lookups:             { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: false },
  dashboard:           { view: true,  edit: false, create: false, delete: false, manage: false, transition: false, approve: false },
  users_roles:         { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: false },
  payments_config:     { view: false, edit: false, create: false, delete: false, manage: false, transition: false, approve: false },
  notifications:       { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: true  },
  applicants:          { view: true,  edit: true,  create: false, delete: true,  manage: true,  transition: true,  approve: false },
  applicant_content:   { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: true  },
  applicant_documents: { view: true,  edit: true,  create: false, delete: true,  manage: false, transition: false, approve: false },
  applicant_payments:  { view: true,  edit: false, create: false, delete: false, manage: true,  transition: false, approve: true  },
};

export function isRowDisabled(module: CloudModuleKey): boolean {
  return CLOUD_MODULES.find((m) => m.key === module)?.state === 'disabled';
}

export function isCellInteractive(module: CloudModuleKey, action: CloudActionKey): boolean {
  if (isRowDisabled(module)) return false;
  return ROW_CAPABILITY_MAP[module][action];
}

export function getModulesBySection(section: CloudSectionKey): readonly CloudModule[] {
  return CLOUD_MODULES.filter((m) => m.section === section);
}

export function permissionToString(p: CloudPermission): string {
  return `${p.module}:${p.action}`;
}

/**
 * Migrate a legacy `<module>:<action>` permission string to its cloud
 * equivalent. Returns `null` for on-prem modules, unknown keys, and
 * cells the matrix doesn't expose — callers silently drop those
 * (operational permissions belong on the on-prem RBAC).
 *
 * The wildcard `'*'` is *not* migrated here (it grants everything by
 * convention and is checked separately by the matrix).
 */
export function migrateLegacyPermission(perm: string): CloudPermission | null {
  if (perm === '*') return null;
  const [legacyModule, legacyAction] = perm.split(':');
  if (!legacyModule || !legacyAction) return null;

  const module = LEGACY_MODULE_MAP[legacyModule];
  if (module === undefined || module === null) return null;

  const action = LEGACY_ACTION_MAP[legacyAction];
  if (action === undefined || action === null) return null;

  if (!ROW_CAPABILITY_MAP[module][action]) return null;
  if (isRowDisabled(module)) return null;

  return { module, action };
}

/**
 * Legacy modules listed exhaustively so that unknown keys surface as
 * `undefined` (not silently null). Operational modules map to `null` —
 * they're recognized as belonging to the on-prem RBAC.
 */
const LEGACY_MODULE_MAP: Record<string, CloudModuleKey | null> = {
  cycles: 'cycles',
  'admission-setup': 'application_setup',
  lookups: 'lookups',
  reports: 'dashboard',
  users: 'users_roles',
  roles: 'users_roles',
  notifications: 'notifications',
  applicants: 'applicants',
  payments: 'applicant_payments',
  committees: null,
  medical: null,
  investigations: null,
  board: null,
  exams: null,
  questions: null,
  biometric: null,
  barcode: null,
  workflows: null,
  audit: null,
  settings: null,
  results: null,
  applicant: null,
};

const LEGACY_ACTION_MAP: Record<string, CloudActionKey | null> = {
  view: 'view',
  read: 'view',
  edit: 'edit',
  write: 'edit',
  create: 'create',
  delete: 'delete',
  manage: 'manage',
  transition: 'transition',
  review: 'approve',
  approve: 'approve',
  print: 'view',
  verify: 'view',
  examine: 'view',
  enter: 'edit',
  refund_eligibility: 'approve',
  apply: null,
};
