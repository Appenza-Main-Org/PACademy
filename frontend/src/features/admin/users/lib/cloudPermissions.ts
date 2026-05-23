/**
 * Cloud permission matrix — governs the admin app and applicant-facing
 * cloud surfaces. Operational on-prem modules have their own RBAC plane
 * and are intentionally absent here.
 */

export type CloudSectionKey = 'admin' | 'applicant';

export type CloudModuleKey =
  | 'dashboard'
  | 'applicants'
  | 'cycles'
  | 'categories'
  | 'application_setup'
  | 'admission_rules'
  | 'lookups'
  | 'lookup_mappings'
  | 'applicant_grades'
  | 'committees_exam_config'
  | 'workflows'
  | 'users_roles'
  | 'audit'
  | 'settings'
  | 'notifications'
  | 'applicant_content'
  | 'applicant_documents'
  | 'applicant_payments';

export type CloudActionKey =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'manage'
  | 'transition'
  | 'approve'
  | 'export'
  | 'toggle'
  | 'import'
  | 'sync'
  | 'reset';

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
  route: string | null;
  state: 'active' | 'disabled';
}

export const CLOUD_MODULES: readonly CloudModule[] = [
  { key: 'dashboard',              nameAr: 'التقارير ولوحة القيادة',          section: 'admin', route: '/admin/reports',                 state: 'active' },
  { key: 'applicants',             nameAr: 'المتقدمون',                       section: 'admin', route: '/admin/applicants',              state: 'active' },
  { key: 'cycles',                 nameAr: 'دورات القبول',                   section: 'admin', route: '/admin/cycles',                  state: 'active' },
  { key: 'categories',             nameAr: 'فئات التقديم',                   section: 'admin', route: '/admin/categories',              state: 'active' },
  { key: 'application_setup',      nameAr: 'إعداد التقديم',                  section: 'admin', route: '/admin/cycles/admission-setup',  state: 'active' },
  { key: 'admission_rules',        nameAr: 'شروط التقدم',                    section: 'admin', route: '/admin/admission-rules',         state: 'active' },
  { key: 'lookups',                nameAr: 'الأكواد المرجعية',               section: 'admin', route: '/admin/lookups',                 state: 'active' },
  { key: 'lookup_mappings',        nameAr: 'خرائط الربط المرجعية',           section: 'admin', route: '/admin/lookups/mappings/:kind',  state: 'active' },
  { key: 'applicant_grades',       nameAr: 'درجات الثانوية العامة والأزهرية', section: 'admin', route: '/admin/applicant-grades',        state: 'active' },
  { key: 'committees_exam_config', nameAr: 'مواعيد الاختبارات واللجان',       section: 'admin', route: '/admin/committees-exam-config', state: 'active' },
  { key: 'workflows',              nameAr: 'سير العمل',                      section: 'admin', route: '/admin/workflows',               state: 'active' },
  { key: 'users_roles',            nameAr: 'المستخدمون والأدوار والصلاحيات',  section: 'admin', route: '/admin/users',                   state: 'active' },
  { key: 'audit',                  nameAr: 'سجل النشاط',                     section: 'admin', route: '/admin/audit',                   state: 'active' },
  { key: 'settings',               nameAr: 'الإعدادات العامة',               section: 'admin', route: '/admin/settings',                state: 'active' },
  { key: 'notifications',          nameAr: 'الإشعارات',                      section: 'admin', route: '/admin/notifications',           state: 'active' },
  { key: 'applicant_payments',     nameAr: 'المدفوعات',                      section: 'admin', route: '/admin/payments',                state: 'active' },
  { key: 'applicant_content',      nameAr: 'محتوى بوابة المتقدمين',          section: 'applicant', route: null,                         state: 'active' },
  { key: 'applicant_documents',    nameAr: 'مستندات المتقدمين',              section: 'applicant', route: null,                         state: 'active' },
] as const;

export interface CloudAction {
  key: CloudActionKey;
  nameAr: string;
}

export const CLOUD_ACTIONS: readonly CloudAction[] = [
  { key: 'view',       nameAr: 'عرض' },
  { key: 'create',     nameAr: 'إنشاء' },
  { key: 'edit',       nameAr: 'تعديل' },
  { key: 'delete',     nameAr: 'حذف' },
  { key: 'manage',     nameAr: 'إدارة' },
  { key: 'transition', nameAr: 'تغيير الحالة' },
  { key: 'approve',    nameAr: 'اعتماد' },
  { key: 'export',     nameAr: 'تصدير' },
  { key: 'toggle',     nameAr: 'تفعيل/تعطيل' },
  { key: 'import',     nameAr: 'استيراد' },
  { key: 'sync',       nameAr: 'مزامنة' },
  { key: 'reset',      nameAr: 'إعادة ضبط' },
] as const;

type CapabilityList = readonly CloudActionKey[];

const ROW_CAPABILITIES = {
  dashboard: ['view', 'export'],
  applicants: ['view', 'create', 'edit', 'delete', 'manage', 'transition', 'export', 'toggle'],
  cycles: ['view', 'create', 'edit', 'delete', 'manage', 'transition', 'approve', 'export', 'toggle'],
  categories: ['view', 'edit', 'delete', 'manage', 'approve', 'export', 'toggle'],
  application_setup: ['view', 'edit', 'manage', 'approve', 'toggle'],
  admission_rules: ['view', 'edit', 'manage', 'approve'],
  lookups: ['view', 'create', 'edit', 'delete', 'manage', 'transition', 'export', 'toggle'],
  lookup_mappings: ['view', 'edit', 'manage', 'approve', 'export'],
  applicant_grades: ['view', 'edit', 'delete', 'manage', 'approve', 'export', 'toggle', 'import'],
  committees_exam_config: ['view', 'create', 'edit', 'delete', 'manage', 'transition', 'approve', 'export', 'toggle', 'sync'],
  workflows: ['view', 'create', 'edit', 'delete', 'manage', 'transition', 'approve', 'export', 'toggle'],
  users_roles: ['view', 'create', 'edit', 'delete', 'manage', 'transition', 'export', 'toggle', 'import', 'reset'],
  audit: ['view', 'export'],
  settings: ['view', 'edit', 'manage', 'approve', 'toggle'],
  notifications: ['view', 'create', 'edit', 'delete', 'manage', 'transition', 'approve', 'export', 'toggle'],
  applicant_payments: ['view', 'edit', 'manage', 'approve', 'export', 'toggle', 'sync'],
  applicant_content: ['view', 'create', 'edit', 'delete', 'manage', 'transition', 'approve', 'export', 'toggle'],
  applicant_documents: ['view', 'edit', 'delete', 'export'],
} as const satisfies Record<CloudModuleKey, CapabilityList>;

export const ROW_CAPABILITY_MAP: Record<CloudModuleKey, Record<CloudActionKey, boolean>> =
  Object.fromEntries(
    Object.entries(ROW_CAPABILITIES).map(([module, actions]) => [
      module,
      Object.fromEntries(
        CLOUD_ACTIONS.map((action) => [action.key, (actions as readonly string[]).includes(action.key)]),
      ),
    ]),
  ) as Record<CloudModuleKey, Record<CloudActionKey, boolean>>;

const CELL_PERMISSION_MAP: Record<CloudModuleKey, Partial<Record<CloudActionKey, string>>> = {
  dashboard: {
    view: 'reports:view',
    export: 'reports:export',
  },
  applicants: {
    view: 'applicants:view',
    create: 'applicants:create',
    edit: 'applicants:edit',
    delete: 'applicants:delete',
    manage: 'applicants:edit',
    transition: 'applicants:transition',
    export: 'applicants:view',
    toggle: 'applicants:edit',
  },
  cycles: {
    view: 'cycles:view',
    create: 'cycles:create',
    edit: 'cycles:edit',
    delete: 'cycles:delete',
    manage: 'cycles:edit',
    transition: 'cycles:transition',
    approve: 'cycles:transition',
    export: 'cycles:view',
    toggle: 'cycles:transition',
  },
  categories: {
    view: 'categories:view',
    edit: 'categories:edit',
    delete: 'categories:delete',
    manage: 'categories:edit',
    approve: 'categories:edit',
    export: 'categories:view',
    toggle: 'categories:edit',
  },
  application_setup: {
    view: 'admission-setup:read',
    edit: 'admission-setup:write',
    manage: 'admission-setup:write',
    approve: 'admission-setup:write',
    toggle: 'admission-setup:write',
  },
  admission_rules: {
    view: 'admission-rules:view',
    edit: 'admission-rules:manage',
    manage: 'admission-rules:manage',
    approve: 'admission-rules:manage',
  },
  lookups: {
    view: 'lookups:view',
    create: 'lookups:create',
    edit: 'lookups:edit',
    delete: 'lookups:delete',
    manage: 'lookups:edit',
    transition: 'lookups:transition',
    export: 'lookups:view',
    toggle: 'lookups:edit',
  },
  lookup_mappings: {
    view: 'lookup-mappings:view',
    edit: 'lookup-mappings:edit',
    manage: 'lookup-mappings:edit',
    approve: 'lookup-mappings:edit',
    export: 'lookup-mappings:view',
  },
  applicant_grades: {
    view: 'applicant-grades:view',
    edit: 'applicant-grades:edit',
    delete: 'applicant-grades:edit',
    manage: 'applicant-grades:edit',
    approve: 'applicant-grades:edit',
    export: 'applicant-grades:view',
    toggle: 'applicant-grades:edit',
    import: 'applicant-grades:import',
  },
  committees_exam_config: {
    view: 'committees-exam-config:view',
    create: 'committees-exam-config:create',
    edit: 'committees-exam-config:edit',
    delete: 'committees-exam-config:delete',
    manage: 'committees-exam-config:edit',
    transition: 'committees-exam-config:transfer',
    approve: 'committees-exam-config:edit',
    export: 'committees-exam-config:view',
    toggle: 'committees-exam-config:edit',
    sync: 'committees-exam-config:transfer',
  },
  workflows: {
    view: 'workflows:view',
    create: 'workflows:create',
    edit: 'workflows:edit',
    delete: 'workflows:delete',
    manage: 'workflows:edit',
    transition: 'workflows:edit',
    approve: 'workflows:edit',
    export: 'workflows:view',
    toggle: 'workflows:edit',
  },
  users_roles: {
    view: 'users:view',
    create: 'users:create',
    edit: 'users:edit',
    delete: 'users:delete',
    manage: 'roles:manage',
    transition: 'users:edit',
    export: 'users:view',
    toggle: 'users:edit',
    import: 'users:create',
    reset: 'users:reset-2fa',
  },
  audit: {
    view: 'audit:view',
    export: 'audit:export',
  },
  settings: {
    view: 'settings:view',
    edit: 'settings:manage',
    manage: 'settings:manage',
    approve: 'settings:manage',
    toggle: 'settings:manage',
  },
  notifications: {
    view: 'notifications:view',
    create: 'notifications:create',
    edit: 'notifications:edit',
    delete: 'notifications:delete',
    manage: 'notifications:edit',
    transition: 'notifications:publish',
    approve: 'notifications:publish',
    export: 'notifications:view',
    toggle: 'notifications:publish',
  },
  applicant_payments: {
    view: 'payments:review',
    edit: 'payments:approve',
    manage: 'payments:approve',
    approve: 'payments:approve',
    export: 'payments:review',
    toggle: 'payments:approve',
    sync: 'payments:sync',
  },
  applicant_content: {
    view: 'applicant:view',
    create: 'applicant:content',
    edit: 'applicant:content',
    delete: 'applicant:content',
    manage: 'applicant:content',
    transition: 'applicant:content',
    approve: 'applicant:content',
    export: 'applicant:view',
    toggle: 'applicant:content',
  },
  applicant_documents: {
    view: 'applicant:documents',
    edit: 'applicant:documents',
    delete: 'applicant:documents',
    export: 'applicant:documents',
  },
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

export function permissionIdForCell(module: CloudModuleKey, action: CloudActionKey): string {
  return CELL_PERMISSION_MAP[module]?.[action] ?? permissionToString({ module, action });
}

export function explicitCloudPermissionIds(): string[] {
  const out: string[] = [];
  for (const mod of CLOUD_MODULES) {
    for (const act of CLOUD_ACTIONS) {
      if (isCellInteractive(mod.key, act.key)) out.push(permissionIdForCell(mod.key, act.key));
    }
  }
  return [...new Set(out)];
}

export function migrateLegacyPermission(perm: string): CloudPermission | null {
  if (perm === '*') return null;
  const [legacyModule, legacyAction] = perm.split(':');
  if (!legacyModule || !legacyAction) return null;

  const module = LEGACY_MODULE_MAP[legacyModule];
  if (module === undefined || module === null) return null;

  const action = LEGACY_ACTION_MAP[legacyAction];
  if (action === undefined || action === null) return null;

  if (!isCellInteractive(module, action)) return null;
  return { module, action };
}

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
  reset: 'reset',
  print: 'view',
  verify: 'view',
  examine: 'view',
  enter: 'edit',
  refund_eligibility: 'approve',
  apply: null,
};
