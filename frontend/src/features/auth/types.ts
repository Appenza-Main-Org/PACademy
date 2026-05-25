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
}

export interface LoginCredentials {
  username: string;
  password: string;
  role: Role;
}
