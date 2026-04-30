import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Inbox, Send } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'إدارة التحريات',
    items: [
      { key: 'cases',     label: 'كل القضايا', icon: <LayoutDashboard size={18} />, to: ROUTES.investigations.overview, end: true },
      { key: 'incoming',  label: 'الوارد',      icon: <Inbox size={18} />,           to: ROUTES.investigations.incoming },
      { key: 'outgoing',  label: 'الصادر',      icon: <Send size={18} />,            to: ROUTES.investigations.outgoing },
    ],
  },
];

export function InvestigationsLayout(): JSX.Element {
  return (
    <AppShell app="investigations" appLabel="التحريات · 2.3" sidebar={SIDEBAR}>
      <Outlet />
    </AppShell>
  );
}
