/**
 * RoleMultiSelect — multi-role picker for admin user creation/edit.
 *
 * Built on the Radix-popover-based `RadixMultiSelect`. Pulls its options
 * live from the cloud-roles TanStack Query (so any new role added in
 * `/admin/users/roles` shows up immediately without reload), with a
 * static fallback to `ROLE_DEFINITIONS` while the query is loading.
 * Filters out:
 *   - the `applicant` role (admin users are staff, never applicants).
 *   - any soft-deleted role rows from the live source.
 *
 * Validation: at least 1 role required. Renders an inline error when
 * the parent form's zod schema reports `roles` empty.
 */

import { useMemo } from 'react';
import { RadixMultiSelect } from '@/shared/components';
import { ROLE_DEFINITIONS, ROLES, type Role } from '@/features/auth';
import { useRolesAdmin } from '../../api/roles.queries';

interface RoleMultiSelectProps {
  value: Role[];
  onChange: (next: Role[]) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  helper?: string;
  /** Optional override: hide specific role keys (e.g. system-only). */
  excludeRoles?: ReadonlyArray<Role>;
  className?: string;
}

const DEFAULT_EXCLUDE: ReadonlyArray<Role> = ['applicant'];

export function RoleMultiSelect({
  value,
  onChange,
  disabled,
  error,
  label = 'الأدوار',
  helper,
  excludeRoles,
  className,
}: RoleMultiSelectProps): JSX.Element {
  const rolesQuery = useRolesAdmin({ includeDeleted: false });

  const options = useMemo(() => {
    const exclude = new Set<Role>([...DEFAULT_EXCLUDE, ...(excludeRoles ?? [])]);
    /* Live source first: every row in /admin/users/roles becomes a
     * selectable option here. */
    const liveRows = rolesQuery.data ?? [];
    if (liveRows.length > 0) {
      return liveRows
        .filter((r) => !r.deletedAt && !exclude.has(r.key as Role))
        .map((r) => ({
          value: r.key,
          label: r.labelAr,
          keywords: `${r.key} ${r.labelEn ?? ''}`,
        }));
    }
    /* Fallback while the query is loading or returns empty: the static
     * ROLES tuple so the form is usable on first render. */
    return ROLES.filter((r) => !exclude.has(r)).map((r) => ({
      value: r,
      label: ROLE_DEFINITIONS[r].labelAr,
      keywords: r,
    }));
  }, [excludeRoles, rolesQuery.data]);

  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-ink-700">
          {label}
          <span aria-hidden className="ms-1 align-middle text-base font-bold leading-none text-terra-500">*</span>
        </label>
      )}
      <RadixMultiSelect
        value={value}
        onChange={(next) => onChange(next as Role[])}
        options={options}
        disabled={disabled}
        invalid={Boolean(error)}
        ariaLabel={label}
        placeholder="ابحث واختر دوراً واحداً أو أكثر…"
        searchPlaceholder="ابحث في الأدوار…"
      />
      {error ? (
        <p className="mt-1 text-xs text-terra-700">{error}</p>
      ) : (
        <p className="mt-1 text-xs text-ink-500">{helper ?? 'يجب اختيار دور واحد على الأقل'}</p>
      )}
    </div>
  );
}
