/**
 * PermissionMatrix — cloud RBAC matrix for the admin app and applicant
 * portal. Two grouped sections; rows and capabilities come from
 * cloudPermissions.ts. Operational on-prem modules have a separate RBAC
 * surface and never appear here.
 *
 * Permission storage stays string-based (`<module>:<action>`) on the wire
 * — that's what `RoleDefinitionRow.permissions` and the integration
 * contract commit to. Section/cell logic uses the typed cloud taxonomy
 * for rendering only.
 */

import {
  CLOUD_ACTIONS,
  CLOUD_SECTIONS,
  getModulesBySection,
  isCellInteractive,
  isRowDisabled,
  type CloudAction,
  type CloudActionKey,
  type CloudModule,
  type CloudModuleKey,
} from '@/features/admin/users/lib/cloudPermissions';
import { cn } from '@/shared/lib/cn';

export interface PermissionMatrixProps {
  permissions: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
}

export function PermissionMatrix({ permissions, onChange, readOnly }: PermissionMatrixProps): JSX.Element {
  const isSuper = permissions.includes('*');

  const toggle = (mod: CloudModuleKey, act: CloudActionKey): void => {
    const id = `${mod}:${act}`;
    const has = permissions.includes(id);
    onChange(has ? permissions.filter((p) => p !== id) : [...permissions, id]);
  };
  const isOn = (mod: CloudModuleKey, act: CloudActionKey): boolean => {
    if (isSuper) return true;
    return permissions.includes(`${mod}:${act}`) || permissions.includes(`${mod}:*`);
  };

  const lockedAll = readOnly || isSuper;

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
              readOnly={lockedAll}
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
  readOnly: boolean;
}

function MatrixSection({ sectionLabel, modules, actions, isOn, toggle, readOnly }: MatrixSectionProps): JSX.Element {
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
      {modules.map((mod) => {
        const rowDisabled = isRowDisabled(mod.key);
        return (
          <tr
            key={mod.key}
            aria-disabled={rowDisabled || undefined}
            title={rowDisabled ? 'غير مفعّل حالياً' : undefined}
            className={cn(
              'border-b border-border-subtle last:border-b-0',
              rowDisabled && 'opacity-50',
            )}
          >
            <th className="px-3 py-2 text-start font-medium text-ink-900">
              {mod.nameAr}
            </th>
            {actions.map((act) => {
              const interactive = isCellInteractive(mod.key, act.key);
              return (
                <td key={act.key} className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    aria-label={`${mod.nameAr} · ${act.nameAr}`}
                    aria-disabled={!interactive || undefined}
                    checked={interactive && isOn(mod.key, act.key)}
                    disabled={readOnly || !interactive}
                    onChange={interactive ? () => toggle(mod.key, act.key) : undefined}
                    className="h-4 w-4 cursor-pointer accent-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
