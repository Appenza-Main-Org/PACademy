/**
 * RoleMultiSelect — multi-role picker for admin user creation/edit.
 *
 * Wraps shared `MultiSelect`, deriving options from `ROLE_DEFINITIONS`.
 * Filters out:
 *   - the `applicant` role (admin users are staff, never applicants).
 *
 * Validation: at least 1 role required. Renders an inline error when
 * the parent form's zod schema reports `roles` empty.
 */

import { useMemo } from 'react';
import { MultiSelect } from '@/shared/components';
import { ROLE_DEFINITIONS, ROLES, type Role } from '@/features/auth';

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
  const options = useMemo(() => {
    const exclude = new Set<Role>([...DEFAULT_EXCLUDE, ...(excludeRoles ?? [])]);
    return ROLES.filter((r) => !exclude.has(r)).map((r) => ({
      value: r,
      label: ROLE_DEFINITIONS[r].labelAr,
      keywords: r,
    }));
  }, [excludeRoles]);

  return (
    <MultiSelect
      label={label}
      required
      options={options}
      value={value}
      onChange={(next) => onChange(next as Role[])}
      disabled={disabled}
      error={error}
      helper={helper ?? 'يجب اختيار دور واحد على الأقل'}
      placeholder="اختر دوراً واحداً أو أكثر…"
      className={className}
    />
  );
}
