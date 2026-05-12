import axios, { type InternalAxiosRequestConfig } from 'axios';
import { normaliseError } from './errors';

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE = 'csrf-token';

function getCsrfCookie(): string | undefined {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`));
  const raw = match?.split('=')[1];
  return raw ? decodeURIComponent(raw) : undefined;
}

/** Simple pub/sub bus to fire the SessionExpiredBanner without circular deps. */
export const sessionExpiredBus = (() => {
  const listeners = new Set<() => void>();
  return {
    subscribe: (fn: () => void): (() => void) => {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    emit: () => listeners.forEach((fn) => fn()),
  };
})();

/** Singleton axios instance used across the whole frontend. */
const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// CSRF double-submit: attach the token from the cookie on every mutating request.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? '').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const token = getCsrfCookie();
    if (token) {
      config.headers.set(CSRF_HEADER, token);
    }
  }
  return config;
});

// Map non-2xx responses to typed ApiError; emit session-expired event on 401.
// /auth/me is exempt — a 401 on the "am I authenticated?" probe is the
// expected unauthenticated state, not a session-expired event.
apiClient.interceptors.response.use(
  (response) => response,
  (err: unknown) => {
    const apiErr = normaliseError(err);
    const url = (err as { config?: { url?: string } })?.config?.url ?? '';
    const status = 'status' in apiErr ? apiErr.status : 0;
    if (status === 401 && !url.includes('/auth/me')) {
      sessionExpiredBus.emit();
    }
    return Promise.reject(apiErr);
  },
);
