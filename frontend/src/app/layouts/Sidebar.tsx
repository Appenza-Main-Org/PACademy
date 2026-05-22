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
 *
 * Visual hierarchy: every non-first section gets a top hairline + extra
 * padding so groups read as discrete blocks. Collapsible groups carry a
 * chevron and (when expanded) render their children behind a subtle
 * vertical guide so the parent–child relationship reads at a glance.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { hasPermission, useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib/cn';

const GROUP_STORAGE_KEY = 'pa-sidebar-groups';

export interface SidebarItem {
  key: string;
  label: string;
  icon: ReactNode;
  to: string;
  permission?: string;
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
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({
  sections,
  collapsed = false,
  onCollapsedChange,
}: SidebarProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  /* Filter once so the "first visible" index is stable for separator
   * placement — sections hidden by RBAC must not consume the slot. */
  const visibleSections = sections
    .filter((s) => !s.permission || (user !== null && hasPermission(user.permissions, s.permission)))
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || (user !== null && hasPermission(user.permissions, item.permission)),
      ),
    }))
    .filter((section) => section.items.length > 0);
  return (
    <aside
      aria-label="القائمة الجانبية"
      data-collapsed={collapsed || undefined}
      className={cn(
        'sticky top-16 hidden h-[calc(100dvh_-_64px)] flex-shrink-0 overflow-y-auto border-s border-border-subtle bg-surface-card py-3 md:block',
        'transition-[width,padding] duration-base ease-standard motion-reduce:transition-none',
        collapsed ? 'w-16 px-2' : 'w-64 px-3',
      )}
    >
      <div className={cn('mb-3 flex', collapsed ? 'justify-center' : 'justify-end')}>
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
          title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-surface-card text-ink-600',
            'transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-ink-50 hover:text-ink-900',
            'focus-visible:shadow-[var(--ring)] focus-visible:outline-none',
          )}
        >
          {collapsed ? (
            <PanelRightOpen size={17} strokeWidth={1.75} aria-hidden />
          ) : (
            <PanelRightClose size={17} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
      {visibleSections.map((section, i) => {
        const isFirst = i === 0;
        if (section.collapsible) {
          return (
            <CollapsibleSection
              key={section.groupKey ?? section.label ?? `g-${i}`}
              section={section}
              isFirst={isFirst}
              collapsed={collapsed}
            />
          );
        }
        return (
          <PlainSection
            key={section.label ?? `s-${i}`}
            section={section}
            isFirst={isFirst}
            collapsed={collapsed}
          />
        );
      })}
    </aside>
  );
}

/** Shared section spacing — non-first sections get a hairline separator. */
function sectionFrameClass(isFirst: boolean, collapsed: boolean): string {
  return cn(
    collapsed ? 'pb-2' : 'pb-4',
    isFirst ? 'pt-1' : collapsed ? 'mt-2 border-t border-border-subtle pt-2' : 'mt-4 border-t border-border-subtle pt-4',
  );
}

function PlainSection({
  section,
  isFirst,
  collapsed,
}: {
  section: SidebarSection;
  isFirst: boolean;
  collapsed: boolean;
}): JSX.Element {
  const sectionHasActiveItem = useSectionHasActiveItem(section);
  return (
    <div className={sectionFrameClass(isFirst, collapsed)}>
      {section.label && (
        <p
          className={cn(
            'mb-2 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-ink-500',
            sectionHasActiveItem && 'text-[var(--accent-700)]',
            collapsed && 'sr-only',
          )}
        >
          {section.label}
        </p>
      )}
      <nav className={cn('flex flex-col gap-0.5', collapsed && 'items-center')}>
        {section.items.map((item) => (
          <SidebarLink key={item.key} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </div>
  );
}

function CollapsibleSection({
  section,
  isFirst,
  collapsed,
}: {
  section: SidebarSection;
  isFirst: boolean;
  collapsed: boolean;
}): JSX.Element {
  const { pathname } = useLocation();
  const groupKey = section.groupKey ?? section.label ?? 'group';
  const autoExpand = Boolean(
    section.expandWhenPathStartsWith && pathname.startsWith(section.expandWhenPathStartsWith),
  );

  const [expanded, setExpanded] = useState<boolean>(() =>
    autoExpand || readPersistedExpansion(groupKey, section.defaultExpanded ?? true),
  );
  const sectionHasActiveItem = useSectionHasActiveItem(section);

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
    <div className={sectionFrameClass(isFirst, collapsed)}>
      {section.label && !collapsed && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={`sidebar-group-${groupKey}`}
          className={cn(
            'mb-2 flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5',
            'text-2xs font-bold uppercase tracking-wide',
            'transition-colors duration-fast ease-standard',
            'focus-visible:shadow-[var(--ring)] focus-visible:outline-none',
            expanded
              ? 'text-ink-700 hover:bg-ink-50'
              : 'text-ink-500 hover:bg-ink-50 hover:text-ink-700',
            sectionHasActiveItem && 'text-[var(--accent-700)]',
          )}
        >
          <span className="flex items-center gap-2">
            {section.icon && (
              <span className="flex h-4 w-4 items-center justify-center text-current">
                {section.icon}
              </span>
            )}
            <span>{section.label}</span>
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden
            className={cn(
              'transition-transform duration-fast ease-standard motion-reduce:transition-none',
              expanded ? 'rotate-180' : 'rotate-0',
            )}
          />
        </button>
      )}
      {(collapsed || expanded) && (
        <nav
          id={`sidebar-group-${groupKey}`}
          className={cn('relative flex flex-col gap-0.5', collapsed && 'items-center')}
        >
          {/* Vertical guide line — visually anchors children to the group. */}
          {!collapsed && (
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-1.5 start-3 top-1.5 w-px bg-border-default"
            />
          )}
          {section.items.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              indented
              collapsed={collapsed}
            />
          ))}
        </nav>
      )}
    </div>
  );
}

function SidebarLink({
  item,
  indented,
  collapsed,
}: {
  item: SidebarItem;
  indented?: boolean;
  collapsed?: boolean;
}): JSX.Element {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex h-10 items-center rounded-md text-sm transition-colors duration-fast ease-standard',
          'text-ink-700 hover:bg-ink-50',
          'focus-visible:shadow-[var(--ring)] focus-visible:outline-none',
          collapsed ? 'w-10 justify-center px-0' : 'w-full gap-3 px-3',
          indented && !collapsed && 'ps-7',
          isActive && [
            'font-medium',
            'bg-[var(--accent-50)]',
            'text-[var(--accent-600)]',
            /* Active-item accent bar. For nested items it sits at start-3 so
             * it overlays the group guide line; for top-level items it
             * hugs the sidebar edge at start-0. 3px wide per DESIGN §4.14;
             * rounded only on the inner edge so it reads as a bracket, not
             * a pill. */
            'before:absolute before:inset-y-1.5 before:w-[3px] before:rounded-e-[2px] before:bg-[var(--accent-500)]',
            collapsed ? 'before:start-0' : indented ? 'before:start-3' : 'before:start-0',
            'ring-1 ring-border-subtle',
          ],
        )
      }
    >
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-current">
        {item.icon}
      </span>
      <span className={cn('min-w-0 flex-1 truncate', collapsed && 'sr-only')}>
        {item.label}
      </span>
      {item.badge !== undefined && (
        <span
          className={cn(
            'rounded-pill px-2 py-0.5 text-2xs font-bold font-numeric tnum text-white',
            collapsed && 'absolute -end-1 -top-1 min-w-4 px-1 text-[9px]',
          )}
          style={{ background: 'var(--accent-500)' }}
        >
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

function useSectionHasActiveItem(section: SidebarSection): boolean {
  const { pathname } = useLocation();
  return section.items.some((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
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
