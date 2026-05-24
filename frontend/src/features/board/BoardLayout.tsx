import { Outlet } from 'react-router-dom';
import { CalendarClock, Gavel, LayoutDashboard, Users } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'الهيئة وأمانة السر',
    items: [
      { key: 'overview',  label: 'نظرة عامة', icon: <LayoutDashboard size={18} />, to: ROUTES.board.overview, end: true },
      { key: 'sessions',  label: 'الجلسات',    icon: <CalendarClock size={18} />,   to: ROUTES.board.sessions },
      { key: 'decisions', label: 'القرارات',   icon: <Gavel size={18} />,           to: ROUTES.board.decisions },
      { key: 'members',   label: 'الأعضاء',    icon: <Users size={18} />,           to: ROUTES.board.members },
    ],
  },
];

export function BoardLayout(): JSX.Element {
  return (
    <AppShell app="board" appLabel="الهيئة وأمانة السر · 2.2" sidebar={SIDEBAR}>
      <Outlet />
    </AppShell>
  );
}
