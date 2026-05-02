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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodResolver<T extends Record<string, any>>(schema: z.ZodType<T>): any {
  return async (values: T): Promise<unknown> => {
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
    const seg = segments[i]!;
    if (typeof cursor[seg] !== 'object' || cursor[seg] === null) cursor[seg] = {};
    cursor = cursor[seg] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]!] = { type: 'zod', message };
}
