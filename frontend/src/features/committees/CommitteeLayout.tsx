import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'لجان القبول',
    items: [
      { key: 'overview', label: 'نظرة عامة',     icon: <LayoutDashboard size={18} />, to: ROUTES.committee.overview, end: true },
      { key: 'list',     label: 'قائمة اللجان',   icon: <Users size={18} />,           to: ROUTES.committee.list },
      { key: 'schedule', label: 'الجدول الزمني',  icon: <Calendar size={18} />,        to: ROUTES.committee.schedule },
    ],
  },
];

export function CommitteeLayout(): JSX.Element {
  return (
    <AppShell app="committee" appLabel="لجان القبول · 2.1" sidebar={SIDEBAR}>
      <Outlet />
    </AppShell>
  );
}
