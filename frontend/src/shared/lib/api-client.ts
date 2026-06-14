/**
 * Backend API client.
 *
 * Services use real backend calls by default. Production builds on `main`
 * read `VITE_PROD_*`; staging preview builds read `VITE_STAGING_*`.
 * Empty backend URLs fall back to same-origin `/api/...`.
 * Set the matching `*_USE_MOCKS=true` only for explicit local demo/mock mode.
 */

import { AccountInactiveError, ConflictError, NotFoundError, ValidationError, type ConflictCode } from '@/shared/lib/errors';
import { DependencyBlockedError, type DependencyResult } from '@/shared/lib/soft-delete';

type QueryPrimitive = string | number | boolean | null | undefined;
type QueryValue = QueryPrimitive | readonly QueryPrimitive[];
type QueryObject = Record<string, QueryValue> | object;
type RequestBody = BodyInit | object | readonly unknown[] | null | undefined;
type AuthSurface = 'staff' | 'applicant';

interface ApiEnvelopeError {
  code?: string;
  conflictCode?: string;
  payload?: unknown;
  result?: DependencyResult;
  message?: string;
  title?: string;
  detail?: string;
  errors?: unknown;
}

interface RequestOptions {
  query?: QueryObject;
  body?: RequestBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
  skipAuth?: boolean;
  responseType?: 'json' | 'blob';
  /** Keep the request alive through page unload (tab close, navigation away).
   *  Maps to `fetch`'s `keepalive` flag — required for last-chance autosaves
   *  fired from `pagehide`/`visibilitychange`. Bodies are capped at 64KB. */
  keepalive?: boolean;
}

const READ_RETRY_DELAYS_MS = [300, 900] as const;
const TRANSIENT_READ_STATUSES = new Set([502, 503, 504]);
const AUTH_STORAGE_KEYS: Record<AuthSurface, string> = {
  staff: 'pa-auth:staff',
  applicant: 'pa-auth:applicant',
};
const LEGACY_AUTH_STORAGE_KEY = 'pa-auth';

export function isBackendEnabled(): boolean {
  const useMocks = firstFlag(
    import.meta.env.VITE_PROD_USE_MOCKS,
    import.meta.env.VITE_STAGING_USE_MOCKS,
    import.meta.env.VITE_USE_MOCKS,
  );
  if (import.meta.env.PROD && useMocks === 'true') {
    throw new Error('Mock mode is not allowed in production admin builds.');
  }
  return useMocks !== 'true';
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
}

function firstEnv(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = normalizeBaseUrl(value);
    if (normalized) return normalized;
  }
  return '';
}

function firstFlag(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function adminApiBaseUrl(): string {
  return firstEnv(
    import.meta.env.VITE_PROD_ADMIN_API_BASE_URL,
    import.meta.env.VITE_STAGING_ADMIN_API_BASE_URL,
    import.meta.env.VITE_API_BASE_URL,
  );
}

function applicantApiBaseUrl(): string {
  return firstEnv(
    import.meta.env.VITE_PROD_APPLICANT_API_BASE_URL,
    import.meta.env.VITE_STAGING_APPLICANT_API_BASE_URL,
    import.meta.env.VITE_API_BASE_URL,
  );
}

function readAuthToken(surface: AuthSurface): string | null {
  const raw = readStoredAuth(AUTH_STORAGE_KEYS[surface]);
  const token = readTokenFromRawAuth(raw, surface);
  if (token) return token;

  return readTokenFromRawAuth(readStoredAuth(LEGACY_AUTH_STORAGE_KEY), surface);
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

function readTokenFromRawAuth(raw: string | null, surface: AuthSurface): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: { user?: { role?: unknown; token?: unknown } } };
    const user = parsed.state?.user;
    const role = user?.role;
    const expectedSurface = role === 'applicant' ? 'applicant' : 'staff';
    if (expectedSurface !== surface) return null;
    const token = user?.token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function shouldSendAuthHeader(): boolean {
  return true;
}

export function queryString(query?: QueryObject): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query)) {
    const value = rawValue as QueryValue;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) params.append(key, String(item));
      }
      continue;
    }
    params.set(key, String(value));
  }
  const out = params.toString();
  return out ? `?${out}` : '';
}

async function parseResponse(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return res.json();
  if (contentType.includes('text/')) return res.text();
  return res.blob();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeErrorPayload(status: number, parsed: unknown): ApiEnvelopeError {
  if (isRecord(parsed)) {
    return {
      code: typeof parsed.code === 'string' ? parsed.code : undefined,
      conflictCode: typeof parsed.conflictCode === 'string' ? parsed.conflictCode : undefined,
      payload: parsed.payload,
      result: isRecord(parsed.result) ? (parsed.result as unknown as DependencyResult) : undefined,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      detail: typeof parsed.detail === 'string' ? parsed.detail : undefined,
      errors: parsed.errors,
    };
  }
  if (typeof parsed === 'string') return { message: parsed };
  return { message: `HTTP ${status}` };
}

function isDeleteBlockedPayload(parsed: unknown): parsed is { deleted: false; reason: string; referenceCount: number } {
  return isRecord(parsed) &&
    parsed.deleted === false &&
    typeof parsed.reason === 'string' &&
    typeof parsed.referenceCount === 'number';
}

function toServiceError(status: number, parsed: unknown): Error {
  const err = normalizeErrorPayload(status, parsed);
  const message = err.message ?? err.detail ?? err.title;
  if (err.code === 'CONFLICT' && err.conflictCode) {
    return new ConflictError(
      err.conflictCode as ConflictCode,
      err.payload,
      message,
    );
  }
  if (err.code === 'ACCOUNT_INACTIVE') {
    const userId =
      isRecord(err.payload) && typeof err.payload.userId === 'string'
        ? err.payload.userId
        : 'unknown';
    return new AccountInactiveError(userId, message);
  }
  if (err.code === 'DEPENDENCY_BLOCKED' && err.result) {
    return new DependencyBlockedError(err.result, 'هذا السجل', {});
  }
  if (err.code === 'NOT_FOUND' || status === 404) {
    return new NotFoundError(message ?? 'السجل غير موجود');
  }
  if (
    err.code === 'VALIDATION_ERROR' ||
    err.code === 'VALIDATION_FAILED' ||
    err.code === 'FIELD_VALIDATION' ||
    err.code === 'VALIDATION' ||
    status === 422 ||
    (status === 400 && err.errors !== undefined)
  ) {
    return new ValidationError(err.errors ?? err.payload, message);
  }
  const generic = new Error(message ?? `HTTP ${status}`);
  generic.name = err.code ?? 'ApiError';
  return generic;
}

function prepareBody(body: RequestBody, headers: Headers): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams) {
    return body;
  }
  if (typeof body === 'string') return body;
  headers.set('Content-Type', 'application/json');
  return JSON.stringify(body);
}

function shouldRetryRead(method: string, status: number, attempt: number): boolean {
  return method === 'GET' &&
    TRANSIENT_READ_STATUSES.has(status) &&
    attempt < READ_RETRY_DELAYS_MS.length;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', handleAbort);
    const timeoutId = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId);
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

async function fetchWithReadRetry(
  method: string,
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  for (let attempt = 0; attempt <= READ_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (shouldRetryRead(method, res.status, attempt)) {
        await sleep(READ_RETRY_DELAYS_MS[attempt]!, signal);
        continue;
      }
      return res;
    } catch (error) {
      const canRetryNetworkError =
        method === 'GET' &&
        !isAbortError(error) &&
        attempt < READ_RETRY_DELAYS_MS.length;
      if (!canRetryNetworkError) throw error;
      await sleep(READ_RETRY_DELAYS_MS[attempt]!, signal);
    }
  }
  throw new Error('تعذر الاتصال بالخادم');
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
  baseOverride?: string,
  authSurface: AuthSurface = 'staff',
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  const token = options.skipAuth || !shouldSendAuthHeader() ? null : readAuthToken(authSurface);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const base = baseOverride ?? adminApiBaseUrl();
  const body2 = prepareBody(options.body, headers);
  const res = await fetchWithReadRetry(method, `${base}${path}${queryString(options.query)}`, {
    method,
    headers,
    body: body2,
    signal: options.signal,
    keepalive: options.keepalive,
  }, options.signal);
  if (options.responseType === 'blob') {
    if (!res.ok) throw toServiceError(res.status, await parseResponse(res));
    return await res.blob() as T;
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (res.ok && res.status !== 204 && !contentType.includes('application/json')) {
    throw new Error('استجابة الخادم غير صالحة. تحقق من إعدادات اتصال الواجهة الخلفية.');
  }
  const parsed = await parseResponse(res);
  if (!res.ok) {
    if (method === 'DELETE' && res.status === 409 && isDeleteBlockedPayload(parsed)) {
      return parsed as T;
    }
    throw toServiceError(res.status, parsed);
  }
  return parsed as T;
}

async function requestBlob(
  path: string,
  options: RequestOptions = {},
  baseOverride?: string,
  authSurface: AuthSurface = 'staff',
): Promise<Blob> {
  const headers = new Headers(options.headers);
  headers.set('Accept', '*/*');
  const token = options.skipAuth || !shouldSendAuthHeader() ? null : readAuthToken(authSurface);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const base = baseOverride ?? adminApiBaseUrl();
  const res = await fetchWithReadRetry('GET', `${base}${path}${queryString(options.query)}`, {
    method: 'GET',
    headers,
    signal: options.signal,
  }, options.signal);
  if (!res.ok) {
    throw toServiceError(res.status, await parseResponse(res));
  }
  return res.blob();
}

function makeClient(baseUrl: () => string, authSurface: AuthSurface) {
  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options, baseUrl(), authSurface),
    postForm: <T>(path: string, body: Record<string, string>) =>
      request<T>('POST', path, { body: new URLSearchParams(body), skipAuth: true }, baseUrl(), authSurface),
    post: <T>(path: string, body?: RequestBody, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('POST', path, { ...options, body }, baseUrl(), authSurface),
    patch: <T>(path: string, body?: RequestBody, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('PATCH', path, { ...options, body }, baseUrl(), authSurface),
    put: <T>(path: string, body?: RequestBody, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('PUT', path, { ...options, body }, baseUrl(), authSurface),
    delete: <T>(path: string, options?: RequestOptions) =>
      request<T>('DELETE', path, options, baseUrl(), authSurface),
    blob: (path: string, options?: RequestOptions) => requestBlob(path, options, baseUrl(), authSurface),
  };
}

/** Default client — uses the active environment's admin API base URL. */
export const apiClient = makeClient(adminApiBaseUrl, 'staff');

/** Admin API client — uses the active environment's admin API base URL.
 *  Use this for any call that must reach the admin backend from the applicant portal
 *  (e.g. GET /api/applicants/:nid/eligible-categories). */
export const adminApiClient = makeClient(adminApiBaseUrl, 'staff');

/** Applicant API client — uses the active environment's applicant API base URL.
 *  Use this from the applicant portal for all portal-specific endpoints. */
export const applicantApiClient = makeClient(applicantApiBaseUrl, 'applicant');
