/**
 * Marital status options for the Application Settings year row.
 *
 * The lookup catalogue used to ship a `marital-statuses` lookup (see the
 * removed `MaritalStatusRulesPage` reference in
 * `admission-setup/config.ts` and `admission-setup/index.ts`), but it was
 * dropped when the lookup module was rebuilt. This module re-exports the
 * canonical 4 values from `MaritalStatus` in
 * `shared/types/domain.ts` in a row shape that mirrors a future lookup
 * record, so the only thing that needs to change when the lookup ships
 * again is the import — call sites already use `{ code, name, isActive }`.
 *
 * Codes intentionally mirror the legacy English keys (`single`, `married`,
 * `divorced`, `widowed`) so they round-trip cleanly with any rule shape
 * already wired into `CategoryConditionBuilder` and `AgeRulesPage`.
 */

export interface MaritalStatusOption {
  code: string;
  name: string;
  isActive: boolean;
}

export const MARITAL_STATUSES: readonly MaritalStatusOption[] = [
  { code: 'single', name: 'أعزب', isActive: true },
  { code: 'married', name: 'متزوج', isActive: true },
  { code: 'divorced', name: 'مطلق', isActive: true },
  { code: 'widowed', name: 'أرمل', isActive: true },
] as const;

const NAME_BY_CODE = new Map<string, string>(
  MARITAL_STATUSES.map((m) => [m.code, m.name]),
);

export function maritalStatusName(code: string): string {
  return NAME_BY_CODE.get(code) ?? code;
}
