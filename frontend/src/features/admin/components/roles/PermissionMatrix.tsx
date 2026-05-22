/**
 * PermissionMatrix — cloud RBAC matrix for the admin app and applicant
 * portal. Two grouped sections; rows and capabilities come from
 * cloudPermissions.ts.
 *
 * Every cell is selectable — super admins authoring a new role can pick
 * ANY permission on ANY module without UI gating. The `ROW_CAPABILITY_MAP`
 * still informs which cells *typically* apply per module (used elsewhere
 * for legacy migration), but it no longer locks the UI.
 *
 * Permission storage stays string-based (`<module>:<action>`) on the wire
 * — that's what `RoleDefinitionRow.permissions` and the integration
 * contract commit to. The wildcard `'*'` keeps showing every cell as
 * checked; toggling a cell on a wildcard role expands the wildcard into
 * an explicit list (minus the toggled cell) so the admin can override.
 */

import { useMemo } from 'react';
import {
  CLOUD_ACTIONS,
  CLOUD_MODULES,
  CLOUD_SECTIONS,
  getModulesBySection,
  permissionIdForCell,
  type CloudAction,
  type CloudActionKey,
  type CloudModule,
  type CloudModuleKey,
} from '@/features/admin/users/lib/cloudPermissions';

export interface PermissionMatrixProps {
  permissions: string[];
  onChange: (next: string[]) => void;
}

export function PermissionMatrix({ permissions, onChange }: PermissionMatrixProps): JSX.Element {
  const isSuper = permissions.includes('*');

  /* Full enumeration of every `<module>:<action>` pair. Used when the
   * admin overrides a wildcard role — we expand `'*'` to the explicit
   * list so toggling a cell off lands on a coherent state. */
  const allExplicit = useMemo<string[]>(() => {
    const out: string[] = [];
    for (const mod of CLOUD_MODULES) {
      for (const act of CLOUD_ACTIONS) {
        out.push(permissionIdForCell(mod.key, act.key));
      }
    }
    return [...new Set(out)];
  }, []);

  const toggle = (mod: CloudModuleKey, act: CloudActionKey): void => {
    const id = permissionIdForCell(mod, act);
    if (isSuper) {
      onChange(allExplicit.filter((p) => p !== id));
      return;
    }
    const has = permissions.includes(id);
    onChange(has ? permissions.filter((p) => p !== id) : [...permissions, id]);
  };

  const isOn = (mod: CloudModuleKey, act: CloudActionKey): boolean => {
    if (isSuper) return true;
    const id = permissionIdForCell(mod, act);
    const [resource] = id.split(':');
    return permissions.includes(id) || Boolean(resource && permissions.includes(`${resource}:*`));
  };

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      {isSuper && (
        <div className="border-b border-border-subtle bg-teal-50 px-3 py-2 text-2xs text-teal-700">
          هذا الدور يملك جميع الصلاحيات (*) — أزل أي خانة لتحويل الدور إلى قائمة صريحة.
        </div>
      )}
      <table className="w-full text-2xs">
        <thead className="border-b border-border-subtle bg-ink-50 text-2xs text-ink-500">
          <tr>
            <th className="px-3 py-2 text-start font-medium">الوحدة</th>
            {CLOUD_ACTIONS.map((act) => (
              <th key={act.key} className="px-2 py-2 text-center font-medium">
                {act.nameAr}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CLOUD_SECTIONS.map((section) => (
            <MatrixSection
              key={section.key}
              sectionLabel={section.nameAr}
              modules={getModulesBySection(section.key)}
              actions={CLOUD_ACTIONS}
              isOn={isOn}
              toggle={toggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface MatrixSectionProps {
  sectionLabel: string;
  modules: readonly CloudModule[];
  actions: readonly CloudAction[];
  isOn: (mod: CloudModuleKey, act: CloudActionKey) => boolean;
  toggle: (mod: CloudModuleKey, act: CloudActionKey) => void;
}

function MatrixSection({ sectionLabel, modules, actions, isOn, toggle }: MatrixSectionProps): JSX.Element {
  return (
    <>
      <tr className="border-b border-border-subtle bg-ink-50">
        <th
          colSpan={actions.length + 1}
          className="px-3 py-1.5 text-start text-2xs font-semibold uppercase tracking-wide text-ink-700"
        >
          {sectionLabel}
        </th>
      </tr>
      {modules.map((mod) => (
        <tr key={mod.key} className="border-b border-border-subtle last:border-b-0">
          <th className="px-3 py-2 text-start font-medium text-ink-900">{mod.nameAr}</th>
          {actions.map((act) => (
            <td key={act.key} className="px-2 py-1 text-center">
              <input
                type="checkbox"
                aria-label={`${mod.nameAr} · ${act.nameAr}`}
                checked={isOn(mod.key, act.key)}
                onChange={() => toggle(mod.key, act.key)}
                className="h-4 w-4 cursor-pointer accent-teal-500"
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
