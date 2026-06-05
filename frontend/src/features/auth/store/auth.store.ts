/**
 * Auth store — surface-aware browser persistence.
 *
 * Staff and applicant sessions intentionally live under different keys so a
 * saved applicant session cannot hijack /staff-login, and vice versa.
 *
 * Cross-tab logout: sessions are shared across same-browser tabs/windows so
 * staff can open admin links in a new tab without logging in again. A
 * BroadcastChannel fans logout out to every tab on the same surface.
 */

import { create } from 'zustand';
import type { AuthUser } from '../types';

export type AuthSurface = 'staff' | 'applicant';

export const AUTH_STORAGE_KEYS: Record<AuthSurface, string> = {
  staff: 'pa-auth:staff',
  applicant: 'pa-auth:applicant',
};

const LEGACY_AUTH_STORAGE_KEY = 'pa-auth';
const AUTH_BROADCAST_CHANNEL = 'pa-auth-sync';

type AuthBroadcastMessage = { type: 'logout'; surface: AuthSurface };

interface PersistedAuthState {
  state?: {
    user?: AuthUser | null;
    lastActivityAt?: number;
  };
}

interface AuthState {
  user: AuthUser | null;
  lastActivityAt: number | null;
  setUser: (user: AuthUser | null) => void;
  touch: (timestamp?: number) => void;
  clear: (surface?: AuthSurface) => void;
}

function getPathname(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname;
}

export function getAuthSurfaceForPath(pathname = getPathname()): AuthSurface {
  return pathname.startsWith('/applicant') ? 'applicant' : 'staff';
}

export function getAuthSurfaceForUser(user: AuthUser | null): AuthSurface {
  return user?.role === 'applicant' ? 'applicant' : 'staff';
}

function parsePersistedAuth(raw: string | null): PersistedAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedAuthState;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function readStoredAuth(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return raw;
  } catch {
    /* localStorage unavailable — try tab storage. */
  }

  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredAuth(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage unavailable — tab storage still preserves this tab. */
  }

  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable — in-memory Zustand state still works. */
  }
}

function removeStoredAuth(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* localStorage unavailable. */
  }

  try {
    sessionStorage.removeItem(key);
  } catch {
    /* sessionStorage unavailable. */
  }
}

function readAuthSession(surface: AuthSurface): Pick<AuthState, 'user' | 'lastActivityAt'> {
  const persisted = parsePersistedAuth(readStoredAuth(AUTH_STORAGE_KEYS[surface]));
  const user = persisted?.state?.user ?? null;
  if (user && getAuthSurfaceForUser(user) === surface) {
    const lastActivityAt = typeof persisted?.state?.lastActivityAt === 'number'
      ? persisted.state.lastActivityAt
      : user.loggedInAt;
    writeAuthSession(surface, user, lastActivityAt);
    return {
      user,
      lastActivityAt,
    };
  }

  const legacy = parsePersistedAuth(readStoredAuth(LEGACY_AUTH_STORAGE_KEY));
  const legacyUser = legacy?.state?.user ?? null;
  if (legacyUser && getAuthSurfaceForUser(legacyUser) === surface) {
    const lastActivityAt = typeof legacy?.state?.lastActivityAt === 'number'
      ? legacy.state.lastActivityAt
      : legacyUser.loggedInAt;
    writeAuthSession(surface, legacyUser, lastActivityAt);
    removeStoredAuth(LEGACY_AUTH_STORAGE_KEY);
    return { user: legacyUser, lastActivityAt };
  }

  return { user: null, lastActivityAt: null };
}

function writeAuthSession(surface: AuthSurface, user: AuthUser, lastActivityAt: number): void {
  const payload: PersistedAuthState = { state: { user, lastActivityAt } };
  writeStoredAuth(AUTH_STORAGE_KEYS[surface], JSON.stringify(payload));
  removeStoredAuth(LEGACY_AUTH_STORAGE_KEY);
}

function removeAuthSession(surface: AuthSurface): void {
  removeStoredAuth(AUTH_STORAGE_KEYS[surface]);
  removeStoredAuth(LEGACY_AUTH_STORAGE_KEY);
}

const initialSession = readAuthSession(getAuthSurfaceForPath());

function createAuthChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
  } catch {
    return null;
  }
}

const authChannel = createAuthChannel();

function broadcastLogout(surface: AuthSurface): void {
  if (!authChannel) return;
  try {
    authChannel.postMessage({ type: 'logout', surface } satisfies AuthBroadcastMessage);
  } catch {
    /* swallow — broadcast best-effort */
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: initialSession.user,
  lastActivityAt: initialSession.lastActivityAt,
  setUser: (user) => {
    if (!user) {
      get().clear();
      return;
    }

    const lastActivityAt = Date.now();
    writeAuthSession(getAuthSurfaceForUser(user), user, lastActivityAt);
    set({ user, lastActivityAt });
  },
  touch: (timestamp = Date.now()) => {
    const user = get().user;
    if (!user) return;
    writeAuthSession(getAuthSurfaceForUser(user), user, timestamp);
    set({ lastActivityAt: timestamp });
  },
  clear: (surface) => {
    const currentUser = get().user;
    const targetSurface = surface ?? (currentUser ? getAuthSurfaceForUser(currentUser) : getAuthSurfaceForPath());
    removeAuthSession(targetSurface);
    if (!currentUser || getAuthSurfaceForUser(currentUser) === targetSurface) {
      set({ user: null, lastActivityAt: null });
    }
    broadcastLogout(targetSurface);
  },
}));

if (authChannel) {
  /* Sibling-tab logout: clear our in-memory + sessionStorage state without
   * re-broadcasting (BroadcastChannel does not echo to the sender, but the
   * receiver must also not loop). AuthGuard will then bounce protected
   * pages to the right login screen on the next render. */
  authChannel.onmessage = (ev: MessageEvent<AuthBroadcastMessage>) => {
    if (!ev.data || ev.data.type !== 'logout') return;
    const currentUser = useAuthStore.getState().user;
    if (!currentUser || getAuthSurfaceForUser(currentUser) !== ev.data.surface) return;
    removeAuthSession(ev.data.surface);
    useAuthStore.setState({ user: null, lastActivityAt: null });
  };
}

export function getCurrentUser(): AuthUser | null {
  return useAuthStore.getState().user;
}

export function isAuthenticated(): boolean {
  return useAuthStore.getState().user !== null;
}
