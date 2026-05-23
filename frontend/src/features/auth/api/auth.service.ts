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

import { apiClient } from '@/shared/lib/api-client';
import type { AuthUser, LoginCredentials } from '../types';
import type { Role } from '../rbac';

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

function normalizeAuthResponse(response: AuthLoginResponse): AuthUser {
  if ('user' in response) {
    return {
      ...response.user,
      token: response.token,
      loggedInAt: response.user.loggedInAt ?? Date.now(),
    };
  }
  return response;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const response = await apiClient.postForm<AuthLoginResponse>('/api/auth/login-simple', {
      username: credentials.username,
      password: credentials.password,
      role: credentials.role,
      nationalId: credentials.username,
      mobile: credentials.password,
    });
    return normalizeAuthResponse(response);
  },

  async requestOtp(credentials: LoginCredentials): Promise<{ pendingId: string; otpDevice: string }> {
    return apiClient.post('/api/auth/login/request-otp', credentials);
  },

  peekOtpCode(_pendingId: string): string | null {
    return null;
  },

  async verifyOtp(input: { pendingId: string; code: string }): Promise<AuthUser> {
    const response = await apiClient.post<AuthLoginResponse>('/api/auth/login/verify-otp', input);
    return normalizeAuthResponse(response);
  },

  async logout(): Promise<{ ok: true }> {
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
};

export type { Role } from '../rbac';
export { NotFoundError } from '@/shared/lib/errors';
