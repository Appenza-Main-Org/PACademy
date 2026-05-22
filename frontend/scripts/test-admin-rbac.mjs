#!/usr/bin/env node
/**
 * Admin RBAC verifier.
 *
 * Creates one in-memory account per frontend role and validates that:
 *   - only roles with the admin app can enter /admin
 *   - every protected admin route has the expected AuthGuard permission
 *   - the cloud permission matrix persists canonical frontend/backend
 *     permission strings, not display-only matrix ids
 *   - backend seed data contains staff accounts for all staff roles
 *
 * This script does not POST test rows to any environment.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const frontendRoot = path.join(repoRoot, 'frontend');

function loadTsModule(relativePath) {
  const filename = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: filename,
  }).outputText;

  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    require: (specifier) => {
      throw new Error(`Unexpected runtime import ${specifier} while loading ${relativePath}`);
    },
  };
  vm.runInNewContext(output, context, { filename });
  return module.exports;
}

const rbac = loadTsModule('frontend/src/features/auth/rbac.ts');
const cloud = loadTsModule('frontend/src/features/admin/users/lib/cloudPermissions.ts');

const routesSource = fs.readFileSync(path.join(frontendRoot, 'src/routes.tsx'), 'utf8');
const identitySeed = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'backend/admin/PACademy.Admin.Api/SeedData/identity.seed.json'), 'utf8'),
);

const adminRouteMatrix = [
  { path: '/admin', feature: 'Admin index redirect', perm: 'reports:view' },
  { path: '/admin/reports', feature: 'Reports dashboard', routeKey: "reports", perm: 'reports:view' },
  { path: '/admin/applicants', feature: 'Applicants list', routeKey: "applicants", perm: 'applicants:view' },
  { path: '/admin/applicants/new', feature: 'Applicant create', routeKey: "applicants/new", perm: 'applicants:edit' },
  { path: '/admin/applicants/:id', feature: 'Applicant detail', routeKey: "applicants/:id", perm: 'applicants:view' },
  { path: '/admin/applicants/:id/edit', feature: 'Applicant edit', routeKey: "applicants/:id/edit", perm: 'applicants:edit' },
  { path: '/admin/users', feature: 'Users list', routeKey: "users", perm: 'users:view' },
  { path: '/admin/users/new', feature: 'User create', routeKey: "users/new", perm: 'users:create' },
  { path: '/admin/users/roles', feature: 'Roles matrix', routeKey: "users/roles", perm: 'roles:manage' },
  { path: '/admin/users/:id', feature: 'User detail', routeKey: "users/:id", perm: 'users:view' },
  { path: '/admin/users/:id/edit', feature: 'User edit', routeKey: "users/:id/edit", perm: 'users:edit' },
  { path: '/admin/notifications', feature: 'Notifications', routeKey: "notifications", perm: 'notifications:view' },
  { path: '/admin/payments', feature: 'Payments review', routeKey: "payments", perm: 'payments:review' },
  { path: '/admin/audit', feature: 'Audit log', routeKey: "audit", perm: 'audit:view' },
  { path: '/admin/settings', feature: 'Settings', routeKey: "settings", perm: 'settings:manage' },
  { path: '/admin/lookups', feature: 'Lookups hub', routeKey: "lookups", perm: 'lookups:view' },
  { path: '/admin/lookups/:tab', feature: 'Lookup tab', routeKey: "lookups/:tab", perm: 'lookups:view' },
  { path: '/admin/lookups/applicant-categories/:id', feature: 'Applicant category lookup detail', routeKey: "lookups/applicant-categories/:id", perm: 'lookups:view' },
  { path: '/admin/categories', feature: 'Categories list', routeKey: "categories", perm: 'categories:view' },
  { path: '/admin/categories/:key', feature: 'Category edit', routeKey: "categories/:key", perm: 'categories:edit' },
  { path: '/admin/cycles', feature: 'Cycles list', routeKey: "cycles", perm: 'cycles:view' },
  { path: '/admin/cycles/new', feature: 'Cycle create', routeKey: "cycles/new", perm: 'cycles:create' },
  { path: '/admin/cycles/:id', feature: 'Cycle detail', routeKey: "cycles/:id", perm: 'cycles:view' },
  { path: '/admin/cycles/:id/edit', feature: 'Cycle edit', routeKey: "cycles/:id/edit", perm: 'cycles:edit' },
  { path: '/admin/committees-exam-config', feature: 'Committee exam config', routeKey: "committees-exam-config", perm: 'committees-exam-config:view' },
  { path: '/admin/workflows', feature: 'Workflows list', routeKey: "workflows", perm: 'workflows:view' },
  { path: '/admin/workflows/new', feature: 'Workflow create', routeKey: "workflows/new", perm: 'workflows:create' },
  { path: '/admin/workflows/:id', feature: 'Workflow edit', routeKey: "workflows/:id", perm: 'workflows:edit' },
  { path: '/admin/applicant-grades', feature: 'Applicant grades', routeKey: "applicant-grades", perm: 'applicant-grades:view' },
  { path: '/admin/applicant-grades/import', feature: 'Applicant grades import', routeKey: "applicant-grades/import", perm: 'applicant-grades:import' },
  { path: '/admin/applicant-grades/changes', feature: 'Applicant grades changes', routeKey: "applicant-grades/changes", perm: 'applicant-grades:edit' },
  { path: '/admin/admission-rules', feature: 'Admission rules', routeKey: "admission-rules", perm: 'admission-rules:manage' },
  { path: '/admin/cycles/admission-setup', feature: 'Admission setup index', routeKey: "cycles/admission-setup", perm: 'admission-setup:read' },
  { path: '/admin/cycles/admission-setup/wizard/:stepKey', feature: 'Admission setup wizard', routeKey: "cycles/admission-setup/wizard/:stepKey", perm: 'admission-setup:read' },
  { path: '/admin/cycles/admission-setup/application-settings', feature: 'Application settings', routeKey: "cycles/admission-setup/application-settings", perm: 'admission-setup:read' },
  { path: '/admin/cycles/admission-setup/application-settings-review', feature: 'Application settings review', routeKey: "cycles/admission-setup/application-settings-review", perm: 'admission-setup:read' },
  { path: '/admin/cycles/admission-setup/application-status', feature: 'Application status', routeKey: "cycles/admission-setup/application-status", perm: 'admission-setup:read' },
  { path: '/admin/cycles/admission-setup/fees', feature: 'Fees setup', routeKey: "cycles/admission-setup/fees", perm: 'admission-setup:read' },
  { path: '/admin/cycles/admission-setup/exams', feature: 'Exams setup', routeKey: "cycles/admission-setup/exams", perm: 'admission-setup:read' },
  { path: '/admin/cycles/admission-setup/electronic-declaration', feature: 'Electronic declaration', routeKey: "cycles/admission-setup/electronic-declaration", perm: 'admission-setup:read' },
];

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function hasPermission(permissions, required) {
  return rbac.hasPermission(permissions, required);
}

function accountForRole(role, index) {
  const def = rbac.ROLE_DEFINITIONS[role];
  return {
    id: `RBAC-${String(index + 1).padStart(2, '0')}`,
    name: `اختبار صلاحيات · ${def.labelAr}`,
    role,
    roleLabel: def.labelAr,
    apps: def.apps,
    permissions: def.permissions,
    token: `rbac.${role}.test`,
    loggedInAt: 1,
  };
}

function routeEntryHasGuard(routeKey, perm) {
  if (!routeKey) return true;
  const pathNeedle = `path: '${routeKey}'`;
  const index = routesSource.indexOf(pathNeedle);
  if (index === -1) return false;
  const entry = routesSource.slice(index, index + 500);
  return entry.includes('AuthGuard') && entry.includes(`perm="${perm}"`);
}

const roles = rbac.ROLES;
assert(roles.length === 11, `Expected 11 frontend roles, found ${roles.length}`);
for (const role of roles) {
  assert(Boolean(rbac.ROLE_DEFINITIONS[role]), `Missing ROLE_DEFINITIONS.${role}`);
}

const accounts = roles.map(accountForRole);
const adminAccounts = accounts.filter((account) => rbac.canAccessApp(account.apps, 'admin'));
assert(
  adminAccounts.map((a) => a.role).join(',') === 'super_admin,committee_admin',
  `Expected only super_admin and committee_admin to carry admin app access, found: ${adminAccounts.map((a) => a.role).join(', ')}`,
);

for (const route of adminRouteMatrix) {
  assert(routeEntryHasGuard(route.routeKey, route.perm), `${route.path} is missing AuthGuard perm="${route.perm}"`);
}

const routeAccessRows = [];
for (const account of accounts) {
  for (const route of adminRouteMatrix) {
    const allowed = rbac.canAccessApp(account.apps, 'admin') && hasPermission(account.permissions, route.perm);
    routeAccessRows.push({ role: account.role, route: route.path, perm: route.perm, allowed });
  }
}

const cloudCells = [];
for (const module of cloud.CLOUD_MODULES) {
  for (const action of cloud.CLOUD_ACTIONS) {
    if (!cloud.isCellInteractive(module.key, action.key)) continue;
    const permission = cloud.permissionIdForCell(module.key, action.key);
    assert(Boolean(permission) && permission.includes(':'), `Cloud cell ${module.key}:${action.key} did not resolve to a canonical permission`);
    cloudCells.push({ module: module.key, action: action.key, permission });
  }
}

const seedUsersByRole = new Map(identitySeed.users.map((user) => [user.role, user]));
for (const role of roles) {
  if (role === 'applicant') continue;
  assert(seedUsersByRole.has(role), `Backend identity seed is missing a staff account for role ${role}`);
}

const unknownSeedRoles = identitySeed.roles
  .map((role) => role.key)
  .filter((role) => !roles.includes(role));

const adminDeniedRoles = accounts
  .filter((account) => !rbac.canAccessApp(account.apps, 'admin'))
  .map((account) => account.role);

const reportLines = [
  '# Admin RBAC Verification',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Accounts Created In Memory',
  '',
  '| Role | Account id | Apps | Permissions |',
  '|---|---:|---|---|',
  ...accounts.map((account) => (
    `| \`${account.role}\` | \`${account.id}\` | ${account.apps.join(', ')} | ${account.permissions.join(', ')} |`
  )),
  '',
  '## Admin Route Access',
  '',
  '| Route | Required permission | Allowed roles | Denied roles |',
  '|---|---|---|---|',
  ...adminRouteMatrix.map((route) => {
    const rows = routeAccessRows.filter((row) => row.route === route.path);
    const allowed = rows.filter((row) => row.allowed).map((row) => `\`${row.role}\``).join(', ') || 'none';
    const denied = rows.filter((row) => !row.allowed).map((row) => `\`${row.role}\``).join(', ') || 'none';
    return `| \`${route.path}\` | \`${route.perm}\` | ${allowed} | ${denied} |`;
  }),
  '',
  '## Cloud Matrix Mapping',
  '',
  '| Module | Action | Canonical permission |',
  '|---|---|---|',
  ...cloudCells.map((cell) => `| \`${cell.module}\` | \`${cell.action}\` | \`${cell.permission}\` |`),
  '',
  '## Backend Seed Coverage',
  '',
  `- Staff roles with seed accounts: ${roles.filter((r) => r !== 'applicant' && seedUsersByRole.has(r)).map((r) => `\`${r}\``).join(', ')}`,
  '- `applicant` is intentionally not a staff/admin user account; applicant auth is handled by the applicant surface.',
  unknownSeedRoles.length > 0
    ? `- Extra backend role rows outside the 11-role frontend tuple: ${unknownSeedRoles.map((r) => `\`${r}\``).join(', ')}`
    : '- No extra backend role rows outside the 11-role frontend tuple.',
  '',
  '## Result',
  '',
  failures.length === 0 ? 'PASS' : `FAIL (${failures.length})`,
  ...failures.map((failure) => `- ${failure}`),
  '',
  '## Admin-App Denial Baseline',
  '',
  `The following roles must be redirected away from \`/admin/*\`: ${adminDeniedRoles.map((role) => `\`${role}\``).join(', ')}.`,
  '',
];

const reportPath = path.join(repoRoot, 'docs/admin-finalization/RBAC_VERIFICATION.md');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${reportLines.join('\n')}\n`);

if (failures.length > 0) {
  console.error(`Admin RBAC verification failed with ${failures.length} issue(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`Report: ${path.relative(repoRoot, reportPath)}`);
  process.exit(1);
}

console.log('Admin RBAC verification passed.');
console.log(`Created ${accounts.length} in-memory role accounts.`);
console.log(`Checked ${adminRouteMatrix.length} admin routes and ${cloudCells.length} interactive cloud matrix cells.`);
console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
