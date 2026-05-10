/**
 * Auth API contract (replace these methods to wire to real backend):
 *   POST /api/auth/login           → { token, user }                (legacy single-step, retained for callers)
 *   POST /api/auth/login/request-otp → { pendingId, otpDevice }     (Gap A — step 1 of 2)
 *   POST /api/auth/login/verify-otp  → { token, user }              (Gap A — step 2 of 2)
 *   GET  /api/auth/me              → user
 *   POST /api/auth/logout          → { ok }
 *   GET  /api/auth/permissions     → string[]
 *   GET  /api/auth/lock-policy                          → LockPolicy
 *   PATCH /api/auth/lock-policy                         → LockPolicy
 *   GET  /api/auth/lock-policy/locked-users             → LockedUser[]
 *   POST /api/auth/lock-policy/unlock                   → { ok }
 */

import { simulateLatency } from '@/shared/lib/mock-helpers';
import { MOCK } from '@/shared/mock-data';
import { emitAudit } from '@/shared/lib/audit';
import { AccountInactiveError } from '@/shared/lib/errors';
import { ROLE_DEFINITIONS, type Role } from '../rbac';
import { useAuthStore } from '../store/auth.store';
import type { AuthUser, LoginCredentials } from '../types';

function fakeJWT(payload: object): string {
  return `mock.${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}.signature`;
}

/* ── Lock-policy mock state (Gap A) ────────────────────────────────────── */

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

const lockPolicy: LockPolicy = { maxFailedAttempts: 5, lockDurationMinutes: 30 };
const failedAttempts = new Map<string, number>();
const lockedUsers = new Map<string, LockedUser>();

/* ── Officer lookup contract (Gap B) ──────────────────────────────────── */

/**
 * Returned shape mirrors the four fields the meeting notes called out:
 * "esm roba3y, rakam qawmy, code el zabet, esm" — full Arabic name,
 * national ID, officer code, and a contact mobile.
 */
export interface OfficerLookupResult {
  fullArabicName: string;
  nationalId: string;
  officerCode: string;
  mobileNumber: string;
}

/** Typed not-found error so callers can branch without parsing strings. */
export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/* Deterministic seed — five officers keyed by (nationalId, officerCode).
 * Real backend looks up the live HR database. */
const OFFICER_DIRECTORY: ReadonlyArray<OfficerLookupResult> = [
  { fullArabicName: 'العميد د. أحمد محمود الفقي محمد',  nationalId: '29512011500011', officerCode: 'OFF-1001', mobileNumber: '01001234521' },
  { fullArabicName: 'العقيد محمد إبراهيم حسن أحمد',     nationalId: '28804120100022', officerCode: 'OFF-1002', mobileNumber: '01112345678' },
  { fullArabicName: 'العقيد د. أيمن شريف رمضان',       nationalId: '29006150700033', officerCode: 'OFF-1003', mobileNumber: '01234567890' },
  { fullArabicName: 'الرائد محمود الديب البنا فاروق',   nationalId: '29209221400044', officerCode: 'OFF-1004', mobileNumber: '01098765432' },
  { fullArabicName: 'النقيب كريم زياد فاروق نصر',       nationalId: '29501081100055', officerCode: 'OFF-1005', mobileNumber: '01556677889' },
];

/* ── OTP pending state (Gap A) ─────────────────────────────────────────── */

export interface OtpPending {
  pendingId: string;
  username: string;
  role: Role;
  otpDevice: string; /* masked phone-tail, e.g. "•••• 1234" */
  expiresAt: number;
  /** Demo only — real backend never echoes the code. */
  devCode: string;
}

const pendingOtps = new Map<string, OtpPending>();

const DEV_BYPASS = '000000';
const OTP_LIFETIME_MS = 5 * 60 * 1000;

function maskedPhone(): string {
  /* Deterministic dummy phone tail for the demo. */
  return '•••• 4521';
}

/**
 * Build an AuthUser at login. Gap C wired this through the dynamic role
 * matrix (MOCK.roleDefinitions) so admin edits to a role's permissions /
 * apps / scope take effect on next login without code changes. Falls
 * back to the static legacy ROLE_DEFINITIONS table if the dynamic seed
 * has no row for the key (newly defined Role union members).
 */
function buildAuthUser(role: Role): AuthUser {
  const dyn = MOCK.roleDefinitions.find((r) => r.key === role && !r.deletedAt);
  const legacy = ROLE_DEFINITIONS[role];
  const matchUser = MOCK.users.find((u) => u.role === role) ?? MOCK.users[0]!;
  return {
    id: matchUser.id,
    name: matchUser.name,
    role,
    roleLabel: dyn?.labelAr ?? legacy.labelAr,
    unit: matchUser.unit,
    apps: dyn ? dyn.apps : legacy.apps,
    permissions: dyn ? dyn.permissions : legacy.permissions,
    token: fakeJWT({ sub: matchUser.id, role, iat: Date.now() }),
    loggedInAt: Date.now(),
  };
}

export const authService = {
  /**
   * Single-step login — retained for backwards compat with auto-bootstrap and
   * non-OTP demo paths. New code should use requestOtp + verifyOtp.
   */
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    await simulateLatency(450, 750);
    const { username, password, role } = credentials;
    if (!username || !password) throw new Error('بيانات الدخول مطلوبة');
    /* Reject inactive accounts (admin-create NID flow). The mock match
     * surface is name-based, so the same role can have multiple seeded
     * users; only an *active* match yields a session. If every match for
     * the role is inactive, we throw `AccountInactiveError`. */
    const matches = MOCK.users.filter((u) => u.role === role);
    if (matches.length > 0 && matches.every((u) => u.accountStatus === 'inactive')) {
      const blocked = matches[0]!;
      emitAudit({
        action: 'login_failed',
        module: 'auth',
        entityType: 'auth.session',
        entityLabel: 'جلسة دخول',
        entityId: blocked.id,
        details: `محاولة دخول لحساب غير نشط — ${blocked.fullArabicName}`,
      });
      throw new AccountInactiveError(blocked.id);
    }
    const user = buildAuthUser(role);
    emitAudit({
      action: 'login_success',
      module: 'auth',
      entityType: 'auth.session',
      entityLabel: 'جلسة دخول',
      entityId: user.id,
      details: `دخول ${user.name}`,
      actor: { id: user.id, name: user.name, role: user.role },
    });
    return user;
  },

  /**
   * Step 1 — credential check + OTP dispatch. Mock generates a 6-digit code,
   * stores it in `pendingOtps`, and returns the masked target phone.
   * Locked users are rejected here.
   */
  async requestOtp(credentials: LoginCredentials): Promise<{ pendingId: string; otpDevice: string }> {
    await simulateLatency(350, 600);
    const { username, password, role } = credentials;
    if (!username || !password) throw new Error('بيانات الدخول مطلوبة');

    const matchUser = MOCK.users.find((u) => u.role === role) ?? MOCK.users[0]!;
    /* Reject inactive accounts before issuing an OTP. */
    if (matchUser.accountStatus === 'inactive') {
      emitAudit({
        action: 'login_failed',
        module: 'auth',
        entityType: 'auth.session',
        entityLabel: 'جلسة دخول',
        entityId: matchUser.id,
        details: `محاولة دخول لحساب غير نشط — ${matchUser.fullArabicName}`,
      });
      throw new AccountInactiveError(matchUser.id);
    }
    const lock = lockedUsers.get(matchUser.id);
    if (lock && (!lock.unlocksAt || new Date(lock.unlocksAt).getTime() > Date.now())) {
      emitAudit({
        action: 'login_failed',
        module: 'auth',
        entityType: 'auth.session',
        entityLabel: 'جلسة دخول',
        entityId: matchUser.id,
        details: `محاولة دخول لحساب موقوف — ${matchUser.name}`,
      });
      throw new Error('الحساب موقوف. تواصل مع إدارة المنظومة لإعادة التفعيل.');
    }

    const pendingId = `OTP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const pending: OtpPending = {
      pendingId,
      username,
      role,
      otpDevice: maskedPhone(),
      expiresAt: Date.now() + OTP_LIFETIME_MS,
      devCode: code,
    };
    pendingOtps.set(pendingId, pending);

    emitAudit({
      action: 'otp_sent',
      module: 'auth',
      entityType: 'auth.session',
      entityLabel: 'جلسة دخول',
      entityId: matchUser.id,
      details: `إرسال رمز التحقق إلى ${pending.otpDevice}`,
    });

    return { pendingId, otpDevice: pending.otpDevice };
  },

  /**
   * Demo helper — exposes the OTP code that was generated for a given pendingId
   * so the LoginForm can hint it in product-register copy. Real backend never
   * echoes codes; remove on integration.
   */
  peekOtpCode(pendingId: string): string | null {
    return pendingOtps.get(pendingId)?.devCode ?? null;
  },

  /**
   * Step 2 — verify OTP and mint the session. dev-bypass `000000` always
   * passes so demo flows don't need to re-read the masked phone. Mismatches
   * count toward the lock policy; the configured threshold flips the actor's
   * state to `locked` and emits `account_locked`.
   */
  async verifyOtp(input: { pendingId: string; code: string }): Promise<AuthUser> {
    await simulateLatency(250, 450);
    const pending = pendingOtps.get(input.pendingId);
    if (!pending) throw new Error('انتهت صلاحية رمز التحقق. أعد طلب رمز جديد.');
    if (pending.expiresAt < Date.now()) {
      pendingOtps.delete(input.pendingId);
      throw new Error('انتهت صلاحية رمز التحقق. أعد طلب رمز جديد.');
    }

    const matchUser = MOCK.users.find((u) => u.role === pending.role) ?? MOCK.users[0]!;
    const isValid = input.code === pending.devCode || input.code === DEV_BYPASS;

    if (!isValid) {
      const next = (failedAttempts.get(matchUser.id) ?? 0) + 1;
      failedAttempts.set(matchUser.id, next);
      emitAudit({
        action: 'otp_failed',
        module: 'auth',
        entityType: 'auth.session',
        entityLabel: 'جلسة دخول',
        entityId: matchUser.id,
        details: `فشل التحقق من الرمز — المحاولات: ${next}/${lockPolicy.maxFailedAttempts}`,
      });
      if (next >= lockPolicy.maxFailedAttempts) {
        const now = new Date();
        const unlocksAt = new Date(now.getTime() + lockPolicy.lockDurationMinutes * 60_000);
        const lock: LockedUser = {
          userId: matchUser.id,
          name: matchUser.name,
          role: pending.role,
          reason: 'تجاوز الحد الأقصى لمحاولات الدخول الفاشلة',
          lockedAt: now.toISOString(),
          unlocksAt: unlocksAt.toISOString(),
        };
        lockedUsers.set(matchUser.id, lock);
        failedAttempts.delete(matchUser.id);
        emitAudit({
          action: 'account_locked',
          module: 'auth',
          entityType: 'auth.user',
          entityLabel: 'حساب مستخدم',
          entityId: matchUser.id,
          details: `تم إيقاف الحساب (${matchUser.name}) بعد تجاوز الحد الأقصى للمحاولات`,
          after: lock,
        });
      }
      throw new Error('رمز التحقق غير صحيح');
    }

    pendingOtps.delete(input.pendingId);
    failedAttempts.delete(matchUser.id);

    const user = buildAuthUser(pending.role);
    emitAudit({
      action: 'otp_verified',
      module: 'auth',
      entityType: 'auth.session',
      entityLabel: 'جلسة دخول',
      entityId: user.id,
      details: `تحقق ناجح من رمز ${user.name}`,
      actor: { id: user.id, name: user.name, role: user.role },
    });
    emitAudit({
      action: 'login_success',
      module: 'auth',
      entityType: 'auth.session',
      entityLabel: 'جلسة دخول',
      entityId: user.id,
      details: `دخول ${user.name}`,
      actor: { id: user.id, name: user.name, role: user.role },
    });
    return user;
  },

  async logout(): Promise<{ ok: true }> {
    await simulateLatency(120, 220);
    return { ok: true };
  },

  async me(): Promise<AuthUser | null> {
    await simulateLatency(50, 100);
    return useAuthStore.getState().user;
  },

  /* ── Lock policy administration (Gap A) ─────────────────────────────── */

  async getLockPolicy(): Promise<LockPolicy> {
    await simulateLatency(60, 120);
    return { ...lockPolicy };
  },

  async updateLockPolicy(patch: Partial<LockPolicy>): Promise<LockPolicy> {
    await simulateLatency();
    if (patch.maxFailedAttempts !== undefined) {
      if (patch.maxFailedAttempts < 1 || patch.maxFailedAttempts > 10) {
        throw new Error('الحد الأقصى لعدد المحاولات يجب أن يكون بين 1 و 10');
      }
      lockPolicy.maxFailedAttempts = patch.maxFailedAttempts;
    }
    if (patch.lockDurationMinutes !== undefined) {
      if (patch.lockDurationMinutes < 5 || patch.lockDurationMinutes > 120) {
        throw new Error('مدة الإيقاف يجب أن تكون بين 5 و 120 دقيقة');
      }
      lockPolicy.lockDurationMinutes = patch.lockDurationMinutes;
    }
    emitAudit({
      action: 'update',
      module: 'auth',
      entityType: 'auth.lock-policy',
      entityLabel: 'سياسة الإيقاف',
      entityId: 'lock-policy',
      details: `تعديل سياسة الإيقاف`,
      after: { ...lockPolicy },
    });
    return { ...lockPolicy };
  },

  async getLockedUsers(): Promise<LockedUser[]> {
    await simulateLatency(60, 120);
    return Array.from(lockedUsers.values());
  },

  /**
   * Officer lookup contract (Gap B).
   *
   * INTEGRATION CONTRACT:
   *   GET /v1/officers/lookup?nid=:nationalId&code=:officerCode
   *
   * Real backend resolves the four fields from the HR database. Mock
   * matches against the seeded `OFFICER_DIRECTORY`. Throws `NotFoundError`
   * for unknown pairs so callers can branch on `err.code === 'NOT_FOUND'`.
   */
  async lookupOfficer(input: { nationalId: string; officerCode: string }): Promise<OfficerLookupResult> {
    await simulateLatency(200, 400);
    const match = OFFICER_DIRECTORY.find(
      (o) => o.nationalId === input.nationalId && o.officerCode === input.officerCode,
    );
    if (!match) {
      throw new NotFoundError('لم يتم العثور على ضابط بهذا الرقم القومي ورمز الضابط');
    }
    return { ...match };
  },

  async unlockUser(userId: string, reason?: string): Promise<{ ok: true }> {
    await simulateLatency();
    const lock = lockedUsers.get(userId);
    if (!lock) throw new Error('الحساب غير موقوف');
    lockedUsers.delete(userId);
    failedAttempts.delete(userId);
    emitAudit({
      action: 'account_unlocked',
      module: 'auth',
      entityType: 'auth.user',
      entityLabel: 'حساب مستخدم',
      entityId: userId,
      details: reason
        ? `إعادة تفعيل (${lock.name}) — السبب: ${reason}`
        : `إعادة تفعيل (${lock.name})`,
      before: lock,
    });
    return { ok: true };
  },
};

export type { Role } from '../rbac';
