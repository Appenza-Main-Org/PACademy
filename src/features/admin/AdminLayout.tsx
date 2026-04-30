import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, FileText, Settings, BarChart3, ClipboardList } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'الإدارة',
    items: [
      { key: 'dashboard',  label: 'لوحة التحكم',     icon: <LayoutDashboard size={18} />, to: ROUTES.admin.dashboard,  end: true },
      { key: 'applicants', label: 'المتقدمون',         icon: <ClipboardList size={18} />,   to: ROUTES.admin.applicants },
      { key: 'users',      label: 'مستخدمو المنظومة',  icon: <Users size={18} />,           to: ROUTES.admin.users },
      { key: 'audit',      label: 'سجل النشاط',         icon: <Shield size={18} />,          to: ROUTES.admin.audit },
    ],
  },
  {
    label: 'الإعدادات والتقارير',
    items: [
      { key: 'reports',  label: 'التقارير',          icon: <BarChart3 size={18} />, to: ROUTES.admin.reports },
      { key: 'settings', label: 'الإعدادات العامة',  icon: <Settings size={18} />,  to: ROUTES.admin.settings },
      { key: 'docs',     label: 'الوثائق المرجعية',  icon: <FileText size={18} />,  to: ROUTES.admin.settings },
    ],
  },
];

export function AdminLayout(): JSX.Element {
  return (
    <AppShell app="admin" appLabel="إدارة منظومة القبول · 1.1" sidebar={SIDEBAR}>
      <Outlet />
    </AppShell>
  );
}
