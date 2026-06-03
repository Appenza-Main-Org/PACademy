/**
 * Auth API contract:
 *   POST /api/auth/login              → { token, user }
 *   POST /api/auth/login/request-otp  → { pendingId, otpDevice }
 *   POST /api/auth/login/verify-otp   → { token, user }
 *   GET  /api/auth/me                 → AuthUser | null
 *   POST /api/auth/logout             → { ok }
 *   GET  /api/auth/lock-policy        → LockPolicy
 *   PATCH /api/auth/lock-policy       → LockPolicy
 *   GET  /api/auth/lock-policy/locked-users → LockedUser[]
 *   POST /api/auth/lock-policy/unlock → { ok }
 *   GET  /v1/officers/lookup?nid=&code= → OfficerLookupResult
 */

import { apiClient, isBackendEnabled } from '@/shared/lib/api-client';
import type { AuthUser, LoginCredentials } from '../types';
import { ROLE_DEFINITIONS, type Role } from '../rbac';

export interface LockPolicy {
  lockDurationMinutes: number;
}

export interface LockedUser {
  userId: string;
  name: string;
  role: string;
  reason: string;
  lockedAt: string;
  unlocksAt: string | null;
}

export interface OfficerLookupResult {
  fullArabicName: string;
  nationalId: string;
  officerCode: string;
  mobileNumber: string;
}

export interface OtpPending {
  pendingId: string;
  username: string;
  role: Role;
  otpDevice: string;
  expiresAt: number;
  devCode: string;
}

type AuthLoginResponse = AuthUser | { token: string; user: Omit<AuthUser, 'token'> | AuthUser };

function fakeToken(payload: Record<string, unknown>): string {
  return `mock.${btoa(encodeURIComponent(JSON.stringify(payload)))}.signature`;
}

function buildMockUser(credentials: LoginCredentials): AuthUser {
  if (!credentials.username || !credentials.password) {
    throw new Error('بيانات الدخول مطلوبة');
  }

  const roleDef = ROLE_DEFINITIONS[credentials.role] ?? ROLE_DEFINITIONS.super_admin;
  const now = Date.now();

  return {
    id: `mock-${credentials.role}`,
    name: roleDef.labelAr,
    nationalId: credentials.username,
    mobileNumber: credentials.password,
    role: credentials.role,
    roleLabel: roleDef.labelAr,
    apps: roleDef.apps,
    permissions: roleDef.permissions,
    token: fakeToken({ sub: `mock-${credentials.role}`, role: credentials.role, iat: now }),
    loggedInAt: now,
  };
}

function normalizeAuthResponse(response: AuthLoginResponse): AuthUser {
  const user = 'user' in response
    ? {
      ...response.user,
      token: response.token,
      loggedInAt: response.user.loggedInAt ?? Date.now(),
    }
    : response;

  if (user.role === 'super_admin') {
    return {
      ...user,
      roleLabel: ROLE_DEFINITIONS.super_admin.labelAr,
      apps: ROLE_DEFINITIONS.super_admin.apps,
      permissions: ROLE_DEFINITIONS.super_admin.permissions,
    };
  }

  return user;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    if (!isBackendEnabled()) {
      return buildMockUser(credentials);
    }

    /* MOI SSO sign-in.
     *
     * The two-step ministry protocol (POST /token → POST /ValidateLogin) is
     * orchestrated server-side by `/api/auth/moi/login`, which returns the app
     * AuthUser. Until the ministry API is live the backend runs the
     * SimulatedMoiAuthGateway against the local admin store; flipping
     * `Moi:Mode=real` on the backend is the entire migration — this client call
     * does not change.
     *
     * Fallback: retry without a role so the backend uses the user's stored role
     * when it isn't one of the picker tiles (e.g. `admissions_manager`). */
    const tryLogin = (role: Role | undefined): Promise<AuthLoginResponse> =>
      apiClient.post<AuthLoginResponse>('/api/auth/moi/login', {
        userName: credentials.username,
        password: credentials.password,
        ...(role ? { role } : {}),
      }, { skipAuth: true });

    try {
      return normalizeAuthResponse(await tryLogin(credentials.role));
    } catch (firstError) {
      try {
        return normalizeAuthResponse(await tryLogin(undefined));
      } catch {
        throw firstError;
      }
    }
  },

  async requestOtp(credentials: LoginCredentials): Promise<{ pendingId: string; otpDevice: string }> {
    return apiClient.post('/api/auth/login/request-otp', credentials, { skipAuth: true });
  },

  peekOtpCode(_pendingId: string): string | null {
    return null;
  },

  async verifyOtp(input: { pendingId: string; code: string }): Promise<AuthUser> {
    const response = await apiClient.post<AuthLoginResponse>('/api/auth/login/verify-otp', input, {
      skipAuth: true,
    });
    return normalizeAuthResponse(response);
  },

  async logout(): Promise<{ ok: true }> {
    if (!isBackendEnabled()) {
      return { ok: true };
    }

    return apiClient.post('/api/auth/logout');
  },

  async me(): Promise<AuthUser | null> {
    return apiClient.get('/api/auth/me');
  },

  async getLockPolicy(): Promise<LockPolicy> {
    return apiClient.get('/api/auth/lock-policy');
  },

  async updateLockPolicy(patch: Partial<LockPolicy>): Promise<LockPolicy> {
    return apiClient.patch('/api/auth/lock-policy', patch);
  },

  async getLockedUsers(): Promise<LockedUser[]> {
    return apiClient.get('/api/auth/lock-policy/locked-users');
  },

  async lookupOfficer(input: { nationalId: string; officerCode: string }): Promise<OfficerLookupResult> {
    return apiClient.get('/v1/officers/lookup', {
      query: { nid: input.nationalId, code: input.officerCode },
    });
  },

  async unlockUser(userId: string, reason?: string): Promise<{ ok: true }> {
    return apiClient.post('/api/auth/lock-policy/unlock', { userId, reason });
  },

  /** Self-service password change for the signed-in user. */
  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<{ ok: true }> {
    return apiClient.post(`/api/users/${encodeURIComponent(input.userId)}/password`, {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
  },
};

export type { Role } from '../rbac';
export { NotFoundError } from '@/shared/lib/errors';
