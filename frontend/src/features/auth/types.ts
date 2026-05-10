import type { AppKey } from '@/shared/lib/constants';
import type { Role } from './rbac';

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
  roleLabel: string;
  unit: string;
  apps: readonly AppKey[];
  permissions: readonly string[];
  token: string;
  loggedInAt: number;
}

export interface LoginCredentials {
  /** Egyptian 14-digit national ID. */
  nationalId: string;
  password: string;
}
