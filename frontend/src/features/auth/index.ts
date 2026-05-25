export { LoginPage } from './pages/LoginPage';
export { ApplicantLoginPage } from './pages/ApplicantLoginPage';
export { useAuthStore, getCurrentUser, isAuthenticated } from './store/auth.store';
export { getDefaultRouteForUser } from './lib/default-route';
export { ROLE_DEFINITIONS, ROLES, hasPermission, canAccessApp } from './rbac';
export type { Permission, Role, RoleDefinition } from './rbac';
export type { AuthUser, LoginCredentials } from './types';
export {
  authKeys,
  useLockPolicy,
  useLockedUsers,
  useLoginMutation,
  useLogoutMutation,
  useOfficerLookup,
  useRequestOtpMutation,
  useUnlockUser,
  useUpdateLockPolicy,
  useVerifyOtpMutation,
} from './api/auth.queries';
export { NotFoundError } from './api/auth.service';
export type { LockPolicy, LockedUser, OfficerLookupResult, OtpPending } from './api/auth.service';
