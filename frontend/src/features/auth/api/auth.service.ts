/**
 * INTEGRATION CONTRACT
 *   POST /auth/login           { nationalId, password } → { userId, nationalId, fullName, role, apps }
 *   GET  /auth/me              → { userId, nationalId, fullName, role, apps }
 *   POST /auth/logout          → 204
 */

import { apiClient } from '@/shared/api/client';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { MOCK } from '@/shared/mock-data';
import { ROLE_DEFINITIONS } from '../rbac';
import { useAuthStore } from '../store/auth.store';
import type { AuthUser, LoginCredentials } from '../types';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

function fakeJWT(payload: object): string {
  return `mock.${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}.signature`;
}

interface LoginResponse {
  userId: string;
  nationalId: string;
  fullName: string;
  role: string;
  apps: string[];
}

function mapResponseToAuthUser(res: LoginResponse): AuthUser {
  const role = res.role as AuthUser['role'];
  const roleDef = ROLE_DEFINITIONS[role];
  return {
    id: res.userId,
    name: res.fullName,
    role,
    roleLabel: roleDef?.labelAr ?? role,
    unit: '',
    apps: res.apps as AuthUser['apps'],
    permissions: roleDef?.permissions ?? [],
    token: '',
    loggedInAt: Date.now(),
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    if (isDemoMode) {
      // Demo: pick mock user by role for the role-picker shortcut
      await simulateLatency(450, 750);
      const { nationalId, password, role } = credentials;
      if (!nationalId || !password) throw new Error('بيانات الدخول مطلوبة');
      const roleDef = ROLE_DEFINITIONS[role];
      const matchUser = MOCK.users.find((u) => u.role === role) ?? MOCK.users[0]!;
      return {
        id: matchUser.id,
        name: matchUser.name,
        role,
        roleLabel: roleDef.labelAr,
        unit: matchUser.unit,
        apps: roleDef.apps,
        permissions: roleDef.permissions,
        token: fakeJWT({ sub: matchUser.id, role, iat: Date.now() }),
        loggedInAt: Date.now(),
      };
    }

    const { data } = await apiClient.post<LoginResponse>('/auth/login', {
      nationalId: credentials.nationalId,
      password: credentials.password,
    });
    return mapResponseToAuthUser(data);
  },

  async logout(): Promise<{ ok: true }> {
    if (isDemoMode) {
      await simulateLatency(120, 220);
      return { ok: true };
    }
    await apiClient.post('/auth/logout');
    return { ok: true };
  },

  async me(): Promise<AuthUser | null> {
    if (isDemoMode) {
      await simulateLatency(50, 100);
      // Demo: state-of-truth lives in the Zustand store
      return useAuthStore.getState().user;
    }
    try {
      const { data } = await apiClient.get<LoginResponse>('/auth/me');
      return mapResponseToAuthUser(data);
    } catch {
      return null;
    }
  },
};

export type { Role } from '../rbac';
