/**
 * SessionTimeoutWatcher — expires the active surface after inactivity.
 *
 * The timeout values come from admin general settings when available:
 * staff defaults to 30 minutes, applicants default to 120 minutes.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAuthSurfaceForUser,
  useAuthStore,
  type AuthSurface,
} from '@/features/auth';
import { useAdminSettings } from '@/features/admin/api/settings.queries';
import {
  DEFAULT_APPLICANT_SESSION_TIMEOUT_MINUTES,
  DEFAULT_STAFF_SESSION_TIMEOUT_MINUTES,
} from '@/features/admin/api/settings.service';
import { toast } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import type { AuthUser } from '@/features/auth/types';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const ACTIVITY_TOUCH_THROTTLE_MS = 30_000;
const SESSION_CHECK_INTERVAL_MS = 15_000;

export function SessionTimeoutWatcher(): null {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const lastActivityAt = useAuthStore((s) => s.lastActivityAt);
  const touch = useAuthStore((s) => s.touch);
  const clear = useAuthStore((s) => s.clear);
  const settingsQuery = useAdminSettings({ enabled: Boolean(user) });

  const userRef = useRef<AuthUser | null>(user);
  const lastActivityRef = useRef<number | null>(lastActivityAt);
  const timeoutMsRef = useRef(0);
  const lastTouchWriteRef = useRef(0);

  const timeoutMinutes = useMemo(() => {
    if (user?.role === 'applicant') {
      return normalizeTimeoutMinutes(
        settingsQuery.data?.applicantSessionTimeoutMinutes,
        DEFAULT_APPLICANT_SESSION_TIMEOUT_MINUTES,
      );
    }
    return normalizeTimeoutMinutes(
      settingsQuery.data?.staffSessionTimeoutMinutes,
      DEFAULT_STAFF_SESSION_TIMEOUT_MINUTES,
    );
  }, [
    settingsQuery.data?.applicantSessionTimeoutMinutes,
    settingsQuery.data?.staffSessionTimeoutMinutes,
    user?.role,
  ]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    lastActivityRef.current = lastActivityAt;
  }, [lastActivityAt]);

  useEffect(() => {
    timeoutMsRef.current = timeoutMinutes * 60_000;
  }, [timeoutMinutes]);

  useEffect(() => {
    if (!user) return;

    const expire = (expiredUser: AuthUser): void => {
      const surface = getAuthSurfaceForUser(expiredUser);
      clear(surface);
      toast('انتهت الجلسة بسبب عدم النشاط. يرجى تسجيل الدخول مرة أخرى.', 'warning');
      navigate(getLoginRoute(surface), { replace: true });
    };

    const checkExpired = (): boolean => {
      const activeUser = userRef.current;
      const activeLastActivityAt = lastActivityRef.current;
      const timeoutMs = timeoutMsRef.current;
      if (!activeUser || !activeLastActivityAt || timeoutMs <= 0) return false;
      if (Date.now() - activeLastActivityAt < timeoutMs) return false;
      expire(activeUser);
      return true;
    };

    const handleActivity = (): void => {
      if (checkExpired()) return;
      const now = Date.now();
      if (now - lastTouchWriteRef.current < ACTIVITY_TOUCH_THROTTLE_MS) return;
      lastTouchWriteRef.current = now;
      touch(now);
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') handleActivity();
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', handleVisibility);
    const intervalId = window.setInterval(checkExpired, SESSION_CHECK_INTERVAL_MS);
    checkExpired();

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [clear, navigate, touch, user]);

  return null;
}

function normalizeTimeoutMinutes(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function getLoginRoute(surface: AuthSurface): string {
  return surface === 'applicant' ? ROUTES.applicantLogin : ROUTES.staffLogin;
}
