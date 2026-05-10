/**
 * InvestigationsLayout — wraps every investigations route with the
 * persistent "سرّي" banner per RFP Scope Document §5.2.E.
 */

import { Outlet } from 'react-router-dom';
import { Grid3x3, Inbox, LayoutDashboard, ListChecks, Lock, Mailbox, Send } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'التنقل',
    items: [
      { key: 'hub', label: 'كل التطبيقات', icon: <Grid3x3 size={18} />, to: ROUTES.hub },
    ],
  },
  {
    label: 'إدارة القضايا',
    items: [
      { key: 'cases',  label: 'كل القضايا',     icon: <LayoutDashboard size={18} />, to: ROUTES.investigations.overview, end: true },
      { key: 'create', label: 'فتح قضية جديدة', icon: <Mailbox size={18} />,         to: ROUTES.investigations.create },
    ],
  },
  {
    label: 'صندوق البريد',
    items: [
      { key: 'incoming',     label: 'الوارد',        icon: <Inbox size={18} />,        to: ROUTES.investigations.incoming },
      { key: 'outgoing',     label: 'الصادر',        icon: <Send size={18} />,         to: ROUTES.investigations.outgoing },
      { key: 'distribution', label: 'كشوف التوزيع', icon: <ListChecks size={18} />,  to: ROUTES.investigations.distribution },
    ],
  },
];

export function InvestigationsLayout(): JSX.Element {
  return (
    <AppShell app="investigations" appLabel="التحريات · 2.3" sidebar={SIDEBAR}>
      <SecrecyBanner />
      <CenteredShell>
        <Outlet />
      </CenteredShell>
    </AppShell>
  );
}

function SecrecyBanner(): JSX.Element {
  return (
    <div
      role="alert"
      className="no-print mb-4 flex items-center gap-3 rounded-md border border-terra-500 bg-terra-50 px-4 py-2 text-sm text-terra-800"
    >
      <Lock size={16} strokeWidth={1.75} aria-hidden />
      <p>
        <span className="font-bold">سرّي</span> — جميع البيانات في هذا التطبيق حساسة وكل عمليات
        الاطلاع تُسجَّل في سجل العمليات.
      </p>
    </div>
  );
}
