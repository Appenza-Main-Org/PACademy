/**
 * Permission helper for the universal list-actions stack.
 *
 * The three universal actions (export / import / duplicate) gate on
 * `{entityKey}:{action}` permissions. We don't mutate the seed
 * `ROLE_DEFINITIONS` in `features/auth/rbac.ts` — instead this helper
 * derives a sensible default mapping per `Tasks/LIST_ACTIONS_PROMPT.md §7.3`:
 *
 *   - `*:export`    → satisfied by any actor with a `<entity>:view`,
 *                     `<entity>:read`, `<entity>:manage`, `<entity>:write`,
 *                     or `*` permission.
 *   - `*:import`    → satisfied by any actor with a `<entity>:write`,
 *                     `<entity>:manage`, or `*` permission.
 *   - `*:duplicate` → same as `*:import`.
 *
 * Roles that ship without any of those resource permissions cannot use the
 * action. Super_admin (`permissions: ['*']`) always passes.
 */

export type ListAction = 'export' | 'import' | 'duplicate';

/**
 * Local mirror of the legacy `hasPermission` helper in
 * `features/auth/rbac.ts`. We don't import the feature helper directly so
 * the Clean Arch boundary (`shared/` must not import from `features/`) is
 * preserved. The implementation is one-screen-grep small; keep them in
 * sync by inspection.
 */
function hasPermission(permissions: readonly string[], required: string): boolean {
  if (permissions.includes('*')) return true;
  if (permissions.includes(required)) return true;
  const [resource] = required.split(':');
  if (resource && permissions.includes(`${resource}:*`)) return true;
  return false;
}

/**
 * Map an `entityKey` like `admin.users` to the resource segment used in the
 * role-definition permission strings (e.g. `users` for `users:view`).
 *
 * Most entityKeys map 1:1 onto the resource. A handful (e.g. `admin.audit`,
 * `admin.referenceData`) need an explicit mapping because the legacy
 * `ROLE_DEFINITIONS` uses a different name. Anything not listed falls back
 * to the last dot-segment.
 */
const RESOURCE_OVERRIDES: Record<string, string> = {
  'admin.applicants': 'applicants',
  'admin.users': 'users',
  'admin.audit': 'admin',
  'admin.referenceData': 'admin',
  'admin.cycles': 'admin',
  'admin.categories': 'admin',
  'admin.workflows': 'workflows',
  'admin.notifications': 'admin',
  'admin.payments': 'admin',
  'admin.roles': 'admin',
  'committee.list': 'committees',
  'board.sessions': 'board',
  'board.decisions': 'board',
  'board.members': 'board',
  'investigations.cases': 'investigations',
  'investigations.incoming': 'investigations',
  'investigations.outgoing': 'investigations',
  'investigations.distribution': 'investigations',
  'medical.queue': 'medical',
  'medical.results': 'results',
  'barcode.scans': 'barcode',
  'barcode.batch': 'barcode',
  'biometric.history': 'biometric',
  'biometric.monitoring': 'biometric',
  'exams.questions': 'questions',
  'exams.exams': 'exams',
  'exams.results': 'results',
};

function resourceFor(entityKey: string): string {
  if (entityKey in RESOURCE_OVERRIDES) return RESOURCE_OVERRIDES[entityKey];
  const parts = entityKey.split('.');
  return parts[parts.length - 1] ?? entityKey;
}

const READ_VERBS: readonly string[] = ['view', 'read', 'manage', 'examine', 'verify'];
const WRITE_VERBS: readonly string[] = ['write', 'manage', 'edit', 'enter'];

/**
 * Returns whether the supplied permissions allow `action` against
 * `entityKey`. Falls through to wildcard handling in `hasPermission`.
 *
 * If `permissions` is `undefined` or empty, returns `false`.
 */
export function canPerformListAction(
  permissions: readonly string[] | undefined,
  entityKey: string,
  action: ListAction,
): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes('*')) return true;
  const resource = resourceFor(entityKey);
  /* Direct grant via explicit `<entity>:<action>`. */
  if (hasPermission(permissions, `${resource}:${action}`)) return true;
  /* Derived defaults per the prompt. */
  const verbs = action === 'export' ? READ_VERBS : WRITE_VERBS;
  return verbs.some((verb) => hasPermission(permissions, `${resource}:${verb}`));
}
