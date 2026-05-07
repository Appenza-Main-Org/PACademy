export { LoginPage } from './pages/LoginPage';
export { useAuthStore, getCurrentUser, isAuthenticated } from './store/auth.store';
export { ROLE_DEFINITIONS, ROLES, hasPermission, canAccessApp } from './rbac';
export type { Role, RoleDefinition } from './rbac';
export type { AuthUser, LoginCredentials } from './types';
export {
  authKeys,
  useLockPolicy,
  useLockedUsers,
  useLoginMutation,
  useLogoutMutation,
  useRequestOtpMutation,
  useUnlockUser,
  useUpdateLockPolicy,
  useVerifyOtpMutation,
} from './api/auth.queries';
export type { LockPolicy, LockedUser, OtpPending } from './api/auth.service';
