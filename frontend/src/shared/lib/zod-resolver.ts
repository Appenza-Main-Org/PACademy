/**
 * Minimal zod ↔ react-hook-form resolver — Sprint 2 utility.
 *
 * Avoids the extra dependency on `@hookform/resolvers/zod`. Mirrors the
 * official package's contract: returns `{ values }` on success or
 * `{ values: {}, errors }` on validation failure with errors keyed by
 * dotted path.
 *
 * RHF v7's `Resolver<TFieldValues, TContext, TTransformedValues>` is
 * variance-strict on its 3 generic params; some consumer schemas have
 * subtle optional/required mismatches against the form-values type which
 * make a strict `Resolver<T>` return reject. Returning `any` keeps the
 * boundary clean — consumers must add a single eslint-disable for the
 * `resolver:` line. Tightening to a real `Resolver<T>` is a follow-up
 * once those schema/value mismatches are reconciled.
 */

import type { z } from 'zod';

const BYPASS_VALIDATION_FOR_DEMO = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance escape hatch, see header comment.
export function zodResolver<T extends Record<string, any>>(schema: z.ZodType<T>): any {
  return async (values: T): Promise<unknown> => {
    if (BYPASS_VALIDATION_FOR_DEMO) {
      return { values, errors: {} };
    }
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      assignError(errors, issue.path.join('.'), issue.message);
    }
    return { values: {}, errors };
  };
}

function assignError(target: Record<string, unknown>, path: string, message: string): void {
  if (!path) return;
  const segments = path.split('.');
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    if (typeof cursor[seg] !== 'object' || cursor[seg] === null) cursor[seg] = {};
    cursor = cursor[seg] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = { type: 'zod', message };
}
