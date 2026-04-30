/**
 * Auth API contract (replace these methods to wire to real backend):
 *   POST /api/auth/login           → { token, user }
 *   GET  /api/auth/me              → user
 *   POST /api/auth/logout          → { ok }
 *   GET  /api/auth/permissions     → string[]
 */

import { simulateLatency } from '@/shared/lib/mock-helpers';
import { MOCK } from '@/shared/mock-data';
import { ROLE_DEFINITIONS } from '../rbac';
import { useAuthStore } from '../store/auth.store';
import type { AuthUser, LoginCredentials } from '../types';

function fakeJWT(payload: object): string {
  return `mock.${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}.signature`;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    await simulateLatency(450, 750);
    const { username, password, role } = credentials;
    if (!username || !password) throw new Error('بيانات الدخول مطلوبة');

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
  },

  async logout(): Promise<{ ok: true }> {
    await simulateLatency(120, 220);
    return { ok: true };
  },

  async me(): Promise<AuthUser | null> {
    await simulateLatency(50, 100);
    // For demo: state-of-truth lives in the store; backend would re-validate JWT
    return useAuthStore.getState().user;
  },
};

export type { Role } from '../rbac';
