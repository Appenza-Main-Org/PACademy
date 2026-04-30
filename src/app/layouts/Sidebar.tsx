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
    <aside className="sidebar" aria-label="القائمة الجانبية">
      {sections.map((section, i) => (
        <div className="sidebar-section" key={section.label ?? `s-${i}`}>
          {section.label && <div className="sidebar-label">{section.label}</div>}
          {section.items.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn('nav-item', isActive && 'active')}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
              {item.badge !== undefined && <span className="nav-item-badge">{item.badge}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  );
}
