/**
 * Sidebar — feature navigation.
 * Source: Tasks/DESIGN_SYSTEM.md §4.14.
 *
 * 256px expanded, 64px collapsed (collapse handled by parent class). Active
 * item: 3px start-edge accent + bg accent-50 + text accent-600. Hover bg ink-50.
 * Section labels in 11px tracking-wide uppercase ink-500.
 *
 * Sections may opt-in to a collapsible group:
 *   - `collapsible: true`     turns the label into a chevron toggle.
 *   - `permission`            hides the entire section if the current user
 *                             lacks the permission. Wildcard ('*') passes.
 *   - `defaultExpanded`       initial state when no localStorage entry exists.
 *   - `groupKey`              localStorage key suffix for persistence
 *                             (under `pa-sidebar-groups`). Required when
 *                             `collapsible: true`.
 *   - `expandWhenPathStartsWith`  auto-expand when the current pathname
 *                             starts with this prefix (e.g. step pages).
 */

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { hasPermission, useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib/cn';

const GROUP_STORAGE_KEY = 'pa-sidebar-groups';

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
  /** Renders the label as a chevron-toggleable group. */
  collapsible?: boolean;
  /** Hide the entire section if the current user lacks the permission. */
  permission?: string;
  /** Initial state when no persisted preference exists. Default true. */
  defaultExpanded?: boolean;
  /** Persistence key under `pa-sidebar-groups`. Required if `collapsible`. */
  groupKey?: string;
  /** Decorative icon shown next to the label on collapsible groups. */
  icon?: ReactNode;
  /** Auto-expand the group when the current pathname starts with this. */
  expandWhenPathStartsWith?: string;
}

interface SidebarProps {
  sections: readonly SidebarSection[];
}

export function Sidebar({ sections }: SidebarProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  return (
    <aside
      aria-label="القائمة الجانبية"
      className="sticky top-16 hidden h-[calc(100vh-67px)] w-64 flex-shrink-0 overflow-y-auto border-s border-border-subtle bg-surface-card px-3 py-4 md:block"
    >
      {sections.map((section, i) => {
        if (section.permission && (!user || !hasPermission(user.permissions, section.permission))) {
          return null;
        }
        if (section.collapsible) {
          return <CollapsibleSection key={section.groupKey ?? section.label ?? `g-${i}`} section={section} />;
        }
        return <PlainSection key={section.label ?? `s-${i}`} section={section} />;
      })}
    </aside>
  );
}

function PlainSection({ section }: { section: SidebarSection }): JSX.Element {
  return (
    <div className="mb-6">
      {section.label && (
        <p className="mb-1 px-3 py-1 text-2xs font-medium uppercase tracking-wide text-ink-500">
          {section.label}
        </p>
      )}
      <nav className="flex flex-col gap-0.5">
        {section.items.map((item) => (
          <SidebarLink key={item.key} item={item} />
        ))}
      </nav>
    </div>
  );
}

function CollapsibleSection({ section }: { section: SidebarSection }): JSX.Element {
  const { pathname } = useLocation();
  const groupKey = section.groupKey ?? section.label ?? 'group';
  const autoExpand = Boolean(
    section.expandWhenPathStartsWith && pathname.startsWith(section.expandWhenPathStartsWith),
  );

  const [expanded, setExpanded] = useState<boolean>(() =>
    autoExpand || readPersistedExpansion(groupKey, section.defaultExpanded ?? true),
  );

  /* Auto-expand when the route lands inside the group, even if the user
   * had collapsed it earlier. Don't persist this — the user's last manual
   * toggle should re-take effect when they navigate away. */
  useEffect(() => {
    if (autoExpand && !expanded) setExpanded(true);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [autoExpand]);

  const toggle = (): void => {
    setExpanded((prev) => {
      const next = !prev;
      writePersistedExpansion(groupKey, next);
      return next;
    });
  };

  return (
    <div className="mb-6">
      {section.label && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={`sidebar-group-${groupKey}`}
          className="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-2xs font-medium uppercase tracking-wide text-ink-500 transition-colors duration-fast ease-standard hover:bg-ink-50 hover:text-ink-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          <span className="flex items-center gap-2">
            {section.icon && <span className="flex h-4 w-4 items-center justify-center text-current">{section.icon}</span>}
            <span>{section.label}</span>
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              'transition-transform duration-fast ease-standard motion-reduce:transition-none',
              expanded ? 'rotate-180' : 'rotate-0',
            )}
          />
        </button>
      )}
      {expanded && (
        <nav id={`sidebar-group-${groupKey}`} className="flex flex-col gap-0.5">
          {section.items.map((item) => (
            <SidebarLink key={item.key} item={item} indented />
          ))}
        </nav>
      )}
    </div>
  );
}

function SidebarLink({ item, indented }: { item: SidebarItem; indented?: boolean }): JSX.Element {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-fast ease-standard',
          'text-ink-700 hover:bg-ink-50',
          'focus-visible:shadow-focus-teal focus-visible:outline-none',
          indented && 'ps-7',
          isActive && [
            'font-medium',
            'bg-[var(--accent-50)]',
            'text-[var(--accent-600)]',
            'before:absolute before:inset-y-1 before:start-0 before:w-1 before:rounded-pill before:bg-[var(--accent-500)]',
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
  );
}

interface PersistedGroups {
  [groupKey: string]: boolean;
}

function readPersistedExpansion(groupKey: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(GROUP_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedGroups;
    return parsed[groupKey] ?? fallback;
  } catch {
    return fallback;
  }
}

function writePersistedExpansion(groupKey: string, value: boolean): void {
  try {
    const raw = localStorage.getItem(GROUP_STORAGE_KEY);
    const parsed: PersistedGroups = raw ? (JSON.parse(raw) as PersistedGroups) : {};
    parsed[groupKey] = value;
    localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* localStorage unavailable — fall back to in-memory state. */
  }
}
