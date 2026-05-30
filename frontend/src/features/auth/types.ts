import type { AppKey } from '@/shared/lib/constants';
import type { Role } from './rbac';

export interface AuthUser {
  id: string;
  name: string;
  nationalId?: string;
  mobileNumber?: string;
  email?: string;
  officerCode?: string;
  role: Role;
  roleLabel: string;
  apps: readonly AppKey[];
  permissions: readonly string[];
  token: string;
  loggedInAt: number;
  /** MOI sign-in username (present for backend-authenticated sessions). */
  username?: string;
  /** True when the account still holds an admin-issued temporary password. */
  mustChangePassword?: boolean;
}

export interface LoginCredentials {
  /** MOI username (admin-issued). Mock mode still accepts NID here. */
  username: string;
  password: string;
  role: Role;
}
