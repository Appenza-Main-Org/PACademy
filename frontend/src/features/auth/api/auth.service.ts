/**
 * Auth API — wired to the real backend (spec 007 — Auth + RBAC).
 *
 * INTEGRATION CONTRACT:
 *   POST /auth/login/request-otp  → { pendingId, otpDevice, otpExpiresAt }
 *   POST /auth/login/verify-otp   → AuthUser (sets pa-session cookie)
 *   GET  /auth/me                 → AuthUser | null (401 → null)
 *   POST /auth/logout             → 204 (clears cookie)
 *
 *   GET   /auth/lock-policy
 *   PATCH /auth/lock-policy
 *   GET   /auth/lock-policy/locked-users
 *   POST  /auth/lock-policy/unlock
 *
 *   POST  /v1/officers/lookup
 */

import { apiClient, ApiError } from '@/shared/api';
import { ROLE_DEFINITIONS, type Role } from '../rbac';
import type { AppKey } from '@/shared/lib/constants';
import type { AuthUser, LoginCredentials } from '../types';

/* ── Lock-policy types ──────────────────────────────────────────────────── */

export interface LockPolicy {
  maxFailedAttempts: number;
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

/* ── Officer lookup ─────────────────────────────────────────────────────── */

export interface OfficerLookupResult {
  fullArabicName: string;
  nationalId: string;
  officerCode: string;
  mobileNumber: string;
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/* ── OTP pending state — for the OtpStep UI ─────────────────────────────── */

export interface OtpPending {
  pendingId: string;
  otpDevice: string;
  otpExpiresAt: string;
}

/* ── Backend response shapes ────────────────────────────────────────────── */

interface VerifyOtpResponse {
  userId: string;
  nationalId: string;
  fullName: string;
  role: string;
  roleLabel: string;
  unit: string | null;
  apps: string[];
  permissions: string[];
  token: string;
}

interface MeResponse {
  userId: string;
  nationalId: string;
  fullName: string;
  role: string;
  apps: string[];
  permissions: string[];
}

function asAppKeys(apps: readonly string[]): readonly AppKey[] {
  return apps as readonly AppKey[];
}

function fromVerify(r: VerifyOtpResponse): AuthUser {
  return {
    id: r.userId,
    name: r.fullName,
    role: r.role as Role,
    roleLabel: r.roleLabel,
    unit: r.unit ?? '-',
    apps: asAppKeys(r.apps),
    permissions: r.permissions,
    token: r.token ?? '',
    loggedInAt: Date.now(),
  };
}

function fromMe(r: MeResponse, prev: AuthUser | null): AuthUser {
  // /auth/me does not return roleLabel/unit; fall back to the role-definition
  // table or the previously-stored user when the cookie pre-existed a refresh.
  const def = ROLE_DEFINITIONS[r.role as Role];
  return {
    id: r.userId,
    name: r.fullName,
    role: r.role as Role,
    roleLabel: prev?.roleLabel ?? def?.labelAr ?? r.role,
    unit: prev?.unit ?? '-',
    apps: asAppKeys(r.apps),
    permissions: r.permissions,
    token: '',
    loggedInAt: prev?.loggedInAt ?? Date.now(),
  };
}

/* ── Service ─────────────────────────────────────────────────────────────── */

export const authService = {
  async requestOtp(credentials: LoginCredentials): Promise<OtpPending> {
    const { data } = await apiClient.post<OtpPending>('/auth/login/request-otp', {
      nationalId: credentials.nationalId,
      password: credentials.password,
    });
    return data;
  },

  async verifyOtp(input: { pendingId: string; code: string }): Promise<AuthUser> {
    const { data } = await apiClient.post<VerifyOtpResponse>('/auth/login/verify-otp', {
      pendingId: input.pendingId,
      code: input.code,
    });
    return fromVerify(data);
  },

  async me(prev: AuthUser | null = null): Promise<AuthUser | null> {
    try {
      const { data } = await apiClient.get<MeResponse>('/auth/me');
      return fromMe(data, prev);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  async logout(): Promise<{ ok: true }> {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      // Even if the server reports 401 (already-expired session), treat
      // as logged-out for UX. Re-throw any other error.
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
    return { ok: true };
  },

  /* ── Lock policy ─────────────────────────────────────────────────────── */

  async getLockPolicy(): Promise<LockPolicy> {
    const { data } = await apiClient.get<LockPolicy>('/auth/lock-policy');
    return data;
  },

  async updateLockPolicy(patch: Partial<LockPolicy>): Promise<LockPolicy> {
    const { data } = await apiClient.patch<LockPolicy>('/auth/lock-policy', patch);
    return data;
  },

  async getLockedUsers(): Promise<LockedUser[]> {
    interface Resp { items: LockedUser[]; total: number }
    const { data } = await apiClient.get<Resp>('/auth/lock-policy/locked-users');
    return data.items;
  },

  async unlockUser(userId: string, reason?: string): Promise<{ ok: true }> {
    void reason; // backend doesn't accept a reason; audit row is written server-side
    await apiClient.post('/auth/lock-policy/unlock', { userId });
    return { ok: true };
  },

  /* ── Officer lookup ───────────────────────────────────────────────────── */

  async lookupOfficer(input: {
    nationalId: string;
    officerCode: string;
  }): Promise<OfficerLookupResult> {
    interface OfficerResponse {
      nationalId: string;
      officerCode: string;
      fullName: string;
      mobile: string;
      email: string;
      issueDate: string;
      cardFactoryNumber: string;
      unit: string;
    }
    try {
      const { data } = await apiClient.post<OfficerResponse>('/v1/officers/lookup', {
        nationalId: input.nationalId,
        officerCode: input.officerCode,
      });
      return {
        fullArabicName: data.fullName,
        nationalId: data.nationalId,
        officerCode: data.officerCode,
        mobileNumber: data.mobile,
      };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new NotFoundError('لم يتم العثور على ضابط بهذا الرقم القومي ورمز الضابط');
      }
      throw err;
    }
  },
};

export type { Role } from '../rbac';
