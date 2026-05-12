/**
 * Permission-snapshot provider used by the universal list-actions stack.
 *
 * Mirrors the `setAuditActorProvider` pattern in `audit.ts`: the auth
 * feature registers a provider at app bootstrap so `shared/` code can
 * read the current actor's permissions without violating the Clean Arch
 * rule (`shared/` must not import `features/`).
 */

let permissionsProvider: () => readonly string[] | undefined = () => undefined;

export function setListActionPermissionsProvider(fn: () => readonly string[] | undefined): void {
  permissionsProvider = fn;
}

export function getListActionPermissions(): readonly string[] | undefined {
  return permissionsProvider();
}
