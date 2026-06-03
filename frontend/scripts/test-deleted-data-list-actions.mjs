import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');

async function read(relPath) {
  return readFile(path.join(frontendRoot, relPath), 'utf8');
}

const [
  listActionTypes,
  listActions,
  listActionPermissions,
  dataTable,
  cloudPermissions,
  rolesPage,
  cyclesPage,
  categoriesPage,
  notificationsPage,
] = await Promise.all([
  read('src/shared/components/data-table/list-actions.types.ts'),
  read('src/shared/components/data-table/ListActions.tsx'),
  read('src/shared/lib/list-action-permissions.ts'),
  read('src/shared/components/DataTable.tsx'),
  read('src/features/admin/users/lib/cloudPermissions.ts'),
  read('src/features/admin/pages/RolesPage.tsx'),
  read('src/features/admin/pages/CyclesPage.tsx'),
  read('src/features/admin/pages/CategoriesListPage.tsx'),
  read('src/features/admin/pages/NotificationsPage.tsx'),
]);

assert.match(
  listActionTypes,
  /export interface DeletedDataConfig<TRow>/,
  'list-actions contract must expose a deleted-data config',
);
assert.match(
  listActionTypes,
  /showDeleted: 'عرض المحذوفات'/,
  'shared action labels must include the Show Deleted Data Arabic label',
);
assert.match(
  listActionPermissions,
  /export type ListAction = 'export' \| 'import' \| 'duplicate' \| 'showDeleted'/,
  'list action permissions must include showDeleted',
);
assert.match(
  listActionPermissions,
  /show-deleted/,
  'showDeleted must map to an explicit show-deleted permission',
);
assert.match(
  listActions,
  /canPerformListAction\(permissions, config\.entityKey, 'showDeleted'\)/,
  'ListActions must permission-gate the deleted-data button',
);
assert.match(
  listActions,
  /ACTION_LABELS\.showDeleted/,
  'ListActions must render the Show Deleted Data button from shared labels',
);
assert.match(
  dataTable,
  /const isDeletedRow = Boolean\(listActions\?\.deleted\?\.isDeleted\(row\)\);/,
  'DataTable must detect deleted rows from the shared deleted-data config',
);
assert.match(
  dataTable,
  /isDeletedRow && 'bg-warning-bg/,
  'DataTable must visually distinguish deleted rows',
);
assert.match(
  cloudPermissions,
  /\| 'show_deleted'/,
  'cloud permission actions must include show_deleted',
);
assert.match(
  cloudPermissions,
  /'show-deleted': 'show_deleted'/,
  'legacy permission migration must understand show-deleted',
);

for (const [name, source] of [
  ['RolesPage', rolesPage],
  ['CyclesPage', cyclesPage],
  ['CategoriesListPage', categoriesPage],
  ['NotificationsPage', notificationsPage],
]) {
  assert.match(source, /deleted:\s*{/, `${name} must configure the shared deleted-data list action`);
  assert.match(source, /isDeleted:\s*\([^)]*\) => Boolean\([^)]*\.deletedAt\)/, `${name} must mark deleted rows by deletedAt`);
  assert.match(source, /onToggle:/, `${name} must let the toolbar toggle deleted-data visibility`);
  assert.match(source, /استعادة/, `${name} must offer restore from the same screen`);
}

console.log('deleted data list action regression checks passed');
