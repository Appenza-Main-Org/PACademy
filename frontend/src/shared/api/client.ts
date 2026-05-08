import axios, { type InternalAxiosRequestConfig } from 'axios';
import { normaliseError } from './errors';

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE = 'csrf-token';

function getCsrfCookie(): string | undefined {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`));
  return match?.split('=')[1];
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
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
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
apiClient.interceptors.response.use(
  (response) => response,
  (err: unknown) => {
    const apiErr = normaliseError(err);
    if (apiErr.status === 401) {
      sessionExpiredBus.emit();
    }
    return Promise.reject(apiErr);
  },
);
