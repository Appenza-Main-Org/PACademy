/**
 * PermissionMatrix — Gap C (admin-gaps).
 *
 * Modules × actions checkbox grid. Each cell toggles a `module:action`
 * permission. The wildcard permission `*` (super_admin) renders as a
 * read-only "كل الصلاحيات" pill above the table.
 */

import {
  ACTION_LABELS_AR,
  MODULE_LABELS_AR,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionModule,
} from '@/shared/mock-data/roles';

export interface PermissionMatrixProps {
  permissions: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
}

export function PermissionMatrix({ permissions, onChange, readOnly }: PermissionMatrixProps): JSX.Element {
  const isSuper = permissions.includes('*');

  const toggle = (mod: PermissionModule, act: PermissionAction): void => {
    const id = `${mod}:${act}`;
    const has = permissions.includes(id);
    onChange(has ? permissions.filter((p) => p !== id) : [...permissions, id]);
  };
  const isOn = (mod: PermissionModule, act: PermissionAction): boolean => {
    if (isSuper) return true;
    return permissions.includes(`${mod}:${act}`) || permissions.includes(`${mod}:*`);
  };

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      {isSuper && (
        <div className="border-b border-border-subtle bg-teal-50 px-3 py-2 text-2xs text-teal-700">
          هذا الدور يملك جميع الصلاحيات (*) — لا يمكن تعديل المصفوفة.
        </div>
      )}
      <table className="w-full text-2xs">
        <thead className="border-b border-border-subtle bg-ink-50 text-2xs text-ink-500">
          <tr>
            <th className="px-3 py-2 text-start font-medium">الوحدة</th>
            {PERMISSION_ACTIONS.map((act) => (
              <th key={act} className="px-2 py-2 text-center font-medium">
                {ACTION_LABELS_AR[act]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MODULES.map((mod) => (
            <tr key={mod} className="border-b border-border-subtle last:border-b-0">
              <th className="px-3 py-2 text-start font-medium text-ink-900">
                {MODULE_LABELS_AR[mod]}
              </th>
              {PERMISSION_ACTIONS.map((act) => (
                <td key={act} className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    aria-label={`${MODULE_LABELS_AR[mod]} · ${ACTION_LABELS_AR[act]}`}
                    checked={isOn(mod, act)}
                    disabled={readOnly || isSuper}
                    onChange={() => toggle(mod, act)}
                    className="h-4 w-4 cursor-pointer accent-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
