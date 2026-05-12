/**
 * Marital status options — thin adapter over the `marital-statuses`
 * lookup catalogue entry.
 *
 * Previously this file hardcoded four entries because the lookup
 * catalogue didn't host them. The lookup row landed in 2026-05-12; this
 * module now re-projects those rows in the `{ code, name, isActive }`
 * shape every existing call site already consumes, so no caller has to
 * change at this step.
 *
 * Codes flipped from the legacy English keys (`single`/`married`/…) to
 * the lookup's `MAR-NN` codes. Call sites that compared against the old
 * keys must be migrated alongside this file.
 */

import { LOOKUPS_SEED } from '@/features/lookups/mock/lookups.mock';

export interface MaritalStatusOption {
  code: string;
  name: string;
  isActive: boolean;
}

export const MARITAL_STATUSES: readonly MaritalStatusOption[] =
  LOOKUPS_SEED['marital-statuses'].map((row) => ({
    code: row.code,
    name: row.name,
    isActive: row.isActive,
  }));

const NAME_BY_CODE = new Map<string, string>(
  MARITAL_STATUSES.map((m) => [m.code, m.name]),
);

export function maritalStatusName(code: string): string {
  return NAME_BY_CODE.get(code) ?? code;
}
