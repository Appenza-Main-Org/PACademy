/**
 * RoleSelector — role picker for the demo login (per Tasks/PROMPT_2 §C).
 *
 * Uses lucide icons instead of emoji to honour DESIGN_SYSTEM.md §11
 * ("emoji in production UI" prohibition). Each tile gets the per-app
 * accent of its primary app via inline style.
 *
 * A tile is keyed by a unique `id`, not by `role`, so two tiles can share
 * one role yet land on different apps. The barcode tile and the biometric
 * tile both authenticate as `admissions_system_admin` (the College System
 * Administrator owns both apps) but route to `/barcode` and `/biometric`
 * respectively — see `landing`.
 */

import { Barcode, Fingerprint, ScrollText, UserCog } from 'lucide-react';
import type { ElementType } from 'react';
import { cn } from '@/shared/lib/cn';
import type { Role } from '../rbac';

/** Where a tile sends the user after a successful login. `auto` defers to
 *  `getDefaultRouteForUser`. */
export type RoleTileLanding = 'auto' | 'barcode' | 'biometric' | 'exams';

export interface RoleTile {
  /** Unique tile id (selection key). */
  id: string;
  /** The role this tile authenticates as. */
  role: Role;
  /** Post-login landing app. */
  landing: RoleTileLanding;
  Icon: ElementType;
  label: string;
}

export const ROLE_TILES: readonly RoleTile[] = [
  { id: 'super_admin', role: 'super_admin', landing: 'auto', Icon: UserCog, label: 'إدارة منظومة القبول' },
  { id: 'exams_admin', role: 'exams_admin', landing: 'exams', Icon: ScrollText, label: 'بنك الأسئلة والاختبارات' },
  { id: 'admissions_system_admin', role: 'admissions_system_admin', landing: 'biometric', Icon: Fingerprint, label: 'إدارة البيومتري' },
  { id: 'barcode_admin', role: 'admissions_system_admin', landing: 'barcode', Icon: Barcode, label: 'إدارة الباركود' },
];

interface RoleSelectorProps {
  /** Selected tile id. */
  value: string;
  onChange: (tile: RoleTile) => void;
}

export function RoleSelector({ value, onChange }: RoleSelectorProps): JSX.Element {
  return (
    <div role="radiogroup" aria-label="التطبيق المطلوب" className="grid auto-rows-fr grid-cols-2 gap-2">
      {ROLE_TILES.map((tile) => {
        const { id, Icon, label } = tile;
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(tile)}
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
