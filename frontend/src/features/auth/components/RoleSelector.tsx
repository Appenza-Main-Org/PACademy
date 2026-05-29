/**
 * RoleSelector — role picker for the demo login (per Tasks/PROMPT_2 §C).
 *
 * Uses lucide icons instead of emoji to honour DESIGN_SYSTEM.md §11
 * ("emoji in production UI" prohibition). Each role gets the per-app
 * accent of its primary app via inline style.
 */

import { Fingerprint, ScrollText, UserCog } from 'lucide-react';
import type { ElementType } from 'react';
import { cn } from '@/shared/lib/cn';
import type { Role } from '../rbac';

interface RoleOption {
  key: Role;
  Icon: ElementType;
  label: string;
}

const ROLE_OPTIONS: readonly RoleOption[] = [
  { key: 'super_admin',     Icon: UserCog,        label: 'إدارة منظومة القبول' },
  { key: 'exams_admin',     Icon: ScrollText,     label: 'بنك الأسئلة والاختبارات' },
  { key: 'admissions_system_admin', Icon: Fingerprint, label: 'إدارة البيومتري' },
];

interface RoleSelectorProps {
  value: Role;
  onChange: (role: Role) => void;
}

export function RoleSelector({ value, onChange }: RoleSelectorProps): JSX.Element {
  return (
    <div role="radiogroup" aria-label="الدور الوظيفي" className="grid auto-rows-fr grid-cols-2 gap-2">
      {ROLE_OPTIONS.map(({ key, Icon, label }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(key)}
            className={cn(
              'flex h-full min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-md border bg-surface-card px-2.5 py-3 text-center text-xs font-medium leading-tight transition-colors duration-fast ease-standard',
              'focus-visible:shadow-focus-teal focus-visible:outline-none',
              selected
                ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-focus-teal'
                : 'border-border-default text-ink-700 hover:border-border-strong hover:bg-ink-50',
            )}
          >
            <Icon size={20} strokeWidth={1.75} />
            <span className="text-balance">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
