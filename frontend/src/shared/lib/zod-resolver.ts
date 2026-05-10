/**
 * Minimal zod ↔ react-hook-form resolver — Sprint 2 utility.
 *
 * Avoids the extra dependency on `@hookform/resolvers/zod`. Mirrors the
 * official package's contract: returns `{ values }` on success or
 * `{ values: {}, errors }` on validation failure with errors keyed by
 * dotted path.
 *
 * RHF v7's `Resolver<T, TContext, TTransformedValues>` is variance-strict;
 * we widen the generic on the boundary so consumer code can pass a
 * concrete `z.ZodType<T>` and bind it to RHF's `useForm<T>()` cleanly.
 */

import type { z } from 'zod';

/**
 * Demo bypass: when true, the resolver short-circuits and always returns the
 * raw values with no errors, so live demos can blast through the 11-stage
 * applicant wizard without filling required fields. Flip back to `false`
 * once real validation is needed (e.g. before backend integration).
 */
const BYPASS_VALIDATION_FOR_DEMO = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
