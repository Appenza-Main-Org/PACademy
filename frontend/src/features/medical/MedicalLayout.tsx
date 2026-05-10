import { Outlet } from 'react-router-dom';
import { ClipboardCheck, FileText, Grid3x3, LayoutDashboard, Stethoscope, Users } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
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
    label: 'القومسيون الطبي',
    items: [
      { key: 'overview',    label: 'العيادات',          icon: <LayoutDashboard size={18} />, to: ROUTES.medical.overview, end: true },
      { key: 'queue',       label: 'قائمة الانتظار',     icon: <Users size={18} />,           to: ROUTES.medical.queue },
      { key: 'station',     label: 'العيادة المتخصصة',   icon: <Stethoscope size={18} />,     to: ROUTES.medical.station('eye') },
      { key: 'results',     label: 'إدراج النتائج',      icon: <ClipboardCheck size={18} />,  to: ROUTES.medical.results },
      { key: 'certificate', label: 'الشهادة الطبية',     icon: <FileText size={18} />,        to: ROUTES.medical.certificate },
    ],
  },
];

export function MedicalLayout(): JSX.Element {
  return (
    <AppShell app="medical" appLabel="القومسيون الطبي · 2.4" sidebar={SIDEBAR}>
      <Outlet />
    </AppShell>
  );
}
