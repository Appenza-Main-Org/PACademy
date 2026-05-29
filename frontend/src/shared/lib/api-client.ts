/**
 * Backend API client.
 *
 * Services use real backend calls by default. `VITE_API_BASE_URL` may point
 * at another origin; when it is empty, calls go to same-origin `/api/...`.
 * Set `VITE_USE_MOCKS=true` only for explicit local demo/mock mode.
 */

import { AccountInactiveError, ConflictError, NotFoundError, ValidationError, type ConflictCode } from '@/shared/lib/errors';
import { DependencyBlockedError, type DependencyResult } from '@/shared/lib/soft-delete';

type QueryPrimitive = string | number | boolean | null | undefined;
type QueryValue = QueryPrimitive | readonly QueryPrimitive[];
type QueryObject = Record<string, QueryValue> | object;
type RequestBody = BodyInit | object | readonly unknown[] | null | undefined;

interface ApiEnvelopeError {
  code?: string;
  conflictCode?: string;
  payload?: unknown;
  result?: DependencyResult;
  message?: string;
  errors?: unknown;
}

interface RequestOptions {
  query?: QueryObject;
  body?: RequestBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
  skipAuth?: boolean;
  responseType?: 'json' | 'blob';
}

const READ_RETRY_DELAYS_MS = [300, 900] as const;
const TRANSIENT_READ_STATUSES = new Set([502, 503, 504]);

export function isBackendEnabled(): boolean {
  if (import.meta.env.PROD && import.meta.env.VITE_USE_MOCKS === 'true') {
    throw new Error('VITE_USE_MOCKS=true is not allowed in production admin builds.');
  }
  return import.meta.env.VITE_USE_MOCKS !== 'true';
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

function apiBaseUrl(): string {
  return firstEnv(import.meta.env.VITE_API_BASE_URL);
}

function adminApiBaseUrl(): string {
  return firstEnv(
    import.meta.env.VITE_ADMIN_API_BASE_URL as string | undefined,
    import.meta.env.VITE_ADMIN_API_URL as string | undefined,
    import.meta.env.VITE_API_BASE_URL,
  );
}

function applicantApiBaseUrl(): string {
  return firstEnv(
    import.meta.env.VITE_APPLICANT_API_BASE_URL as string | undefined,
    import.meta.env.VITE_APPLICANT_API_URL as string | undefined,
    import.meta.env.VITE_APPLICANT_API_BASE as string | undefined,
    import.meta.env.VITE_API_BASE_URL,
  );
}

function readAuthToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem('pa-auth');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: { user?: { token?: unknown } } };
    const token = parsed.state?.user?.token;
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
      errors: parsed.errors,
    };
  }
  if (typeof parsed === 'string') return { message: parsed };
  return { message: `HTTP ${status}` };
}

function toServiceError(status: number, parsed: unknown): Error {
  const err = normalizeErrorPayload(status, parsed);
  if (err.code === 'CONFLICT' && err.conflictCode) {
    return new ConflictError(
      err.conflictCode as ConflictCode,
      err.payload,
      err.message,
    );
  }
  if (err.code === 'ACCOUNT_INACTIVE') {
    const userId =
      isRecord(err.payload) && typeof err.payload.userId === 'string'
        ? err.payload.userId
        : 'unknown';
    return new AccountInactiveError(userId, err.message);
  }
  if (err.code === 'DEPENDENCY_BLOCKED' && err.result) {
    return new DependencyBlockedError(err.result, 'هذا السجل', {});
  }
  if (err.code === 'NOT_FOUND' || status === 404) {
    return new NotFoundError(err.message ?? 'السجل غير موجود');
  }
  if (err.code === 'VALIDATION_ERROR' || err.code === 'FIELD_VALIDATION' || status === 422) {
    return new ValidationError(err.errors ?? err.payload, err.message);
  }
  const generic = new Error(err.message ?? `HTTP ${status}`);
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
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  const token = options.skipAuth || !shouldSendAuthHeader() ? null : readAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const base = baseOverride ?? apiBaseUrl();
  const body2 = prepareBody(options.body, headers);
  const res = await fetchWithReadRetry(method, `${base}${path}${queryString(options.query)}`, {
    method,
    headers,
    body: body2,
    signal: options.signal,
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
  if (!res.ok) throw toServiceError(res.status, parsed);
  return parsed as T;
}

async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const headers = new Headers(options.headers);
  headers.set('Accept', '*/*');
  const token = options.skipAuth || !shouldSendAuthHeader() ? null : readAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetchWithReadRetry('GET', `${apiBaseUrl()}${path}${queryString(options.query)}`, {
    method: 'GET',
    headers,
    signal: options.signal,
  }, options.signal);
  if (!res.ok) {
    throw toServiceError(res.status, await parseResponse(res));
  }
  return res.blob();
}

function makeClient(baseUrl: () => string) {
  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options, baseUrl()),
    postForm: <T>(path: string, body: Record<string, string>) =>
      request<T>('POST', path, { body: new URLSearchParams(body), skipAuth: true }, baseUrl()),
    post: <T>(path: string, body?: RequestBody, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('POST', path, { ...options, body }, baseUrl()),
    patch: <T>(path: string, body?: RequestBody, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('PATCH', path, { ...options, body }, baseUrl()),
    put: <T>(path: string, body?: RequestBody, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('PUT', path, { ...options, body }, baseUrl()),
    delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options, baseUrl()),
    blob: (path: string, options?: RequestOptions) => requestBlob(path, options),
  };
}

/** Default client — uses VITE_API_BASE_URL (admin API in admin-first integration). */
export const apiClient = makeClient(apiBaseUrl);

/** Admin API client — uses VITE_ADMIN_API_BASE_URL, falls back to VITE_API_BASE_URL.
 *  Use this for any call that must reach the admin backend from the applicant portal
 *  (e.g. GET /api/applicants/:nid/eligible-categories). */
export const adminApiClient = makeClient(adminApiBaseUrl);

/** Applicant API client — uses VITE_APPLICANT_API_BASE_URL, falls back to VITE_API_BASE_URL.
 *  Use this from the applicant portal for all portal-specific endpoints. */
export const applicantApiClient = makeClient(applicantApiBaseUrl);
