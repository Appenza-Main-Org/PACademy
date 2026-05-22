import { isValidationError } from '@/shared/lib/errors';

interface FieldErrorLike {
  field?: unknown;
  path?: unknown;
  name?: unknown;
  message?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fieldName(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (Array.isArray(value) && value.length > 0) return value.map(String).join('.');
  return null;
}

function messageText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim().length > 0);
    return typeof first === 'string' ? first : null;
  }
  return null;
}

export function validationFieldErrors(err: unknown): Record<string, string> {
  if (!isValidationError(err)) return {};
  const fields = err.fields;
  const out: Record<string, string> = {};

  if (Array.isArray(fields)) {
    for (const item of fields) {
      if (!isRecord(item)) continue;
      const error = item as FieldErrorLike;
      const key = fieldName(error.field ?? error.path ?? error.name);
      const message = messageText(error.message);
      if (key && message) out[key] = message;
    }
    return out;
  }

  if (isRecord(fields)) {
    for (const [key, value] of Object.entries(fields)) {
      const message = messageText(value);
      if (message) out[key] = message;
    }
  }

  return out;
}

export function validationMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
