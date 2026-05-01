/**
 * Sidebar — feature navigation.
 * Source: Tasks/DESIGN_SYSTEM.md §4.14.
 *
 * 256px expanded, 64px collapsed (collapse handled by parent class). Active
 * item: 3px start-edge accent + bg accent-50 + text accent-600. Hover bg ink-50.
 * Section labels in 11px tracking-wide uppercase ink-500.
 */

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';

export interface SidebarItem {
  key: string;
  label: string;
  icon: ReactNode;
  to: string;
  badge?: string | number;
  end?: boolean;
}

export interface SidebarSection {
  label?: string;
  items: SidebarItem[];
}

interface SidebarProps {
  sections: readonly SidebarSection[];
}

export function Sidebar({ sections }: SidebarProps): JSX.Element {
  return (
    <aside
      aria-label="القائمة الجانبية"
      className="sticky top-16 hidden h-[calc(100vh-67px)] w-64 flex-shrink-0 overflow-y-auto border-s border-border-subtle bg-surface-card px-3 py-4 md:block"
    >
      {sections.map((section, i) => (
        <div className="mb-6" key={section.label ?? `s-${i}`}>
          {section.label && (
            <p className="mb-1 px-3 py-1 text-2xs font-medium uppercase tracking-wide text-ink-500">
              {section.label}
            </p>
          )}
          <nav className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-fast ease-standard',
                    'text-ink-700 hover:bg-ink-50',
                    'focus-visible:shadow-focus-teal focus-visible:outline-none',
                    isActive && [
                      'font-medium',
                      'bg-[var(--accent-50)]',
                      'text-[var(--accent-600)]',
                      'before:absolute before:inset-y-1 before:start-0 before:w-0.5 before:rounded-pill before:bg-[var(--accent-500)]',
                    ],
                  )
                }
              >
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-current">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className="rounded-pill px-2 py-0.5 text-2xs font-bold font-numeric tnum text-white"
                    style={{ background: 'var(--accent-500)' }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}
