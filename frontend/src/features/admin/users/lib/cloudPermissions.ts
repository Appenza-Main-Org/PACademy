/**
 * Cloud permission matrix — governs the two internet-facing apps only:
 * the admin app and the applicant portal. Operational on-prem modules
 * (committee runtime, medical, investigations, board, exams, biometric,
 * barcode) deploy on the Ministry's on-prem cluster with their own
 * separate RBAC surface and are intentionally absent here.
 *
 * Closed union — must not be extended to include on-prem operational
 * modules. Those have a separate RBAC on the on-prem deployment;
 * coupling the two planes here would be an architectural regression.
 */

export type CloudSectionKey = 'admin' | 'applicant';

export type CloudModuleKey =
  | 'cycles'
  | 'categories'
  | 'application_setup'
  | 'admission_rules'
  | 'lookups'
  | 'lookup_mappings'
  | 'dashboard'
  | 'users_roles'
  | 'audit'
  | 'settings'
  | 'notifications'
  | 'applicant_grades'
  | 'committees_exam_config'
  | 'workflows'
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
  | 'approve'
  | 'export'
  | 'toggle'
  | 'import'
  | 'sync';

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
  { key: 'dashboard',               nameAr: 'لوحة قيادة منظومة القبول',       section: 'admin', route: '/admin/reports',                  state: 'active' },
  { key: 'cycles',                  nameAr: 'دورات القبول',                  section: 'admin', route: '/admin/cycles',                   state: 'active' },
  { key: 'categories',              nameAr: 'فئات التقديم',                  section: 'admin', route: '/admin/categories',               state: 'active' },
  { key: 'application_setup',       nameAr: 'إعداد التقديم',                  section: 'admin', route: '/admin/cycles/admission-setup',   state: 'active' },
  { key: 'admission_rules',         nameAr: 'شروط التقدم',                    section: 'admin', route: '/admin/admission-rules',          state: 'active' },
  { key: 'lookups',                 nameAr: 'الأكواد المرجعية',               section: 'admin', route: '/admin/lookups',                  state: 'active' },
  { key: 'lookup_mappings',         nameAr: 'خرائط الربط المرجعية',           section: 'admin', route: '/admin/lookups/mappings/:kind',   state: 'active' },
  { key: 'applicant_grades',        nameAr: 'درجات المتقدمين',                section: 'admin', route: '/admin/applicant-grades',         state: 'active' },
  { key: 'committees_exam_config',  nameAr: 'مواعيد الاختبارات واللجان',      section: 'admin', route: '/admin/committees-exam-config',  state: 'active' },
  { key: 'workflows',               nameAr: 'سير العمل',                      section: 'admin', route: '/admin/workflows',                state: 'active' },
  { key: 'users_roles',             nameAr: 'المستخدمون والصلاحيات',          section: 'admin', route: '/admin/users',                    state: 'active' },
  { key: 'audit',                   nameAr: 'سجل النشاط',                     section: 'admin', route: '/admin/audit',                    state: 'active' },
  { key: 'settings',                nameAr: 'الإعدادات العامة',               section: 'admin', route: '/admin/settings',                 state: 'active' },
  { key: 'notifications',           nameAr: 'إدارة الإشعارات',                section: 'admin', route: '/admin/notifications',            state: 'active' },
  { key: 'applicants',              nameAr: 'المتقدمون',                      section: 'applicant', route: '/admin/applicants',           state: 'active' },
  { key: 'applicant_content',       nameAr: 'محتوى البوابة',                  section: 'applicant', route: null,                          state: 'active' },
  { key: 'applicant_documents',     nameAr: 'مستندات المتقدمين',              section: 'applicant', route: null,                          state: 'active' },
  { key: 'applicant_payments',      nameAr: 'مدفوعات المتقدمين',              section: 'applicant', route: '/admin/payments',             state: 'active' },
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
  { key: 'export',     nameAr: 'تصدير' },
  { key: 'toggle',     nameAr: 'تفعيل/تعطيل' },
  { key: 'import',     nameAr: 'استيراد' },
  { key: 'sync',       nameAr: 'مزامنة' },
] as const;

type RowCapabilities = Record<CloudActionKey, boolean>;

/**
 * Per-row capability map — single source of truth for which cells are
 * interactive. Disabled rows render with every cell non-interactive
 * regardless of this map.
 */
export const ROW_CAPABILITY_MAP: Record<CloudModuleKey, RowCapabilities> = {
  dashboard:              { view: true,  edit: false, create: false, delete: false, manage: false, transition: false, approve: false, export: true,  toggle: false, import: false, sync: false },
  cycles:                 { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: true,  export: true,  toggle: true,  import: false, sync: false },
  categories:             { view: true,  edit: true,  create: false, delete: true,  manage: true,  transition: false, approve: true,  export: true,  toggle: true,  import: false, sync: false },
  application_setup:      { view: true,  edit: true,  create: false, delete: false, manage: true,  transition: false, approve: true,  export: false, toggle: true,  import: false, sync: false },
  admission_rules:        { view: true,  edit: true,  create: false, delete: false, manage: true,  transition: false, approve: true,  export: false, toggle: false, import: false, sync: false },
  lookups:                { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: false, export: true,  toggle: true,  import: false, sync: false },
  lookup_mappings:        { view: true,  edit: true,  create: false, delete: false, manage: true,  transition: false, approve: true,  export: true,  toggle: false, import: false, sync: false },
  applicant_grades:       { view: true,  edit: true,  create: false, delete: true,  manage: true,  transition: false, approve: true,  export: true,  toggle: true,  import: true,  sync: false },
  committees_exam_config: { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: true,  export: true,  toggle: true,  import: false, sync: true  },
  workflows:              { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: true,  export: true,  toggle: true,  import: false, sync: false },
  users_roles:            { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: false, export: true,  toggle: true,  import: true,  sync: false },
  audit:                  { view: true,  edit: false, create: false, delete: false, manage: false, transition: false, approve: false, export: true,  toggle: false, import: false, sync: false },
  settings:               { view: true,  edit: true,  create: false, delete: false, manage: true,  transition: false, approve: true,  export: false, toggle: true,  import: false, sync: false },
  notifications:          { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: true,  export: true,  toggle: true,  import: false, sync: false },
  applicants:             { view: true,  edit: true,  create: false, delete: true,  manage: true,  transition: true,  approve: false, export: true,  toggle: true,  import: false, sync: false },
  applicant_content:      { view: true,  edit: true,  create: true,  delete: true,  manage: true,  transition: true,  approve: true,  export: true,  toggle: true,  import: false, sync: false },
  applicant_documents:    { view: true,  edit: true,  create: false, delete: true,  manage: false, transition: false, approve: false, export: true,  toggle: false, import: false, sync: false },
  applicant_payments:     { view: true,  edit: true,  create: false, delete: false, manage: true,  transition: false, approve: true,  export: true,  toggle: true,  import: false, sync: true  },
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
  categories: 'categories',
  'admission-setup': 'application_setup',
  'admission-rules': 'admission_rules',
  lookups: 'lookups',
  mappings: 'lookup_mappings',
  reports: 'dashboard',
  users: 'users_roles',
  roles: 'users_roles',
  notifications: 'notifications',
  'applicant-grades': 'applicant_grades',
  applicants: 'applicants',
  payments: 'applicant_payments',
  audit: 'audit',
  settings: 'settings',
  workflows: 'workflows',
  'committees-exam-config': 'committees_exam_config',
  committees: null,
  medical: null,
  investigations: null,
  board: null,
  exams: null,
  questions: null,
  biometric: null,
  barcode: null,
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
  export: 'export',
  toggle: 'toggle',
  import: 'import',
  sync: 'sync',
  print: 'view',
  verify: 'view',
  examine: 'view',
  enter: 'edit',
  refund_eligibility: 'approve',
  apply: null,
};
