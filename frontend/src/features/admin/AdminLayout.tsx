import { Outlet } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Database,
  Grid3x3,
  Layers,
  LayoutDashboard,
  Settings,
  Shield,
  SlidersHorizontal,
  Users,
  Workflow,
} from 'lucide-react';
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
    label: 'الإدارة',
    items: [
      { key: 'dashboard',  label: 'لوحة التحكم',     icon: <LayoutDashboard size={18} />, to: ROUTES.admin.dashboard,  end: true },
      { key: 'applicants', label: 'المتقدمون',         icon: <ClipboardList size={18} />,   to: ROUTES.admin.applicants },
      { key: 'users',      label: 'مستخدمو المنظومة',  icon: <Users size={18} />,           to: ROUTES.admin.users },
      { key: 'roles',      label: 'الأدوار والصلاحيات', icon: <Shield size={18} />,          to: ROUTES.admin.roles },
      { key: 'audit',      label: 'سجل النشاط',         icon: <Shield size={18} />,          to: ROUTES.admin.audit },
    ],
  },
  /**
   * التقديم — groups the cycle-bootstrapping surfaces together: categories
   * and cycles seed the data model, then the wizard at
   * `/admin/admission-setup/wizard/:stepKey` runs the 15-step
   * configuration flow over the picked cycle. Order matches the natural
   * authoring sequence (define categories → open a cycle → configure it).
   * Hidden entirely if the user lacks `admission-setup:read`.
   */
  {
    label: 'التقديم',
    permission: 'admission-setup:read',
    items: [
      { key: 'categories',      label: 'فئات التقديم', icon: <Layers size={18} />,         to: ROUTES.admin.categories },
      { key: 'cycles',          label: 'الدورات',      icon: <CalendarDays size={18} />,    to: ROUTES.admin.cycles },
      /* Committee management — admin-side entry point into the committees
       * surface (super_admin and committee_admin both have the `committee`
       * app in RBAC, so AuthGuard lets them through to /committee/list). */
      { key: 'committees',      label: 'اللجان',         icon: <Briefcase size={18} />,       to: ROUTES.committee.list },
      { key: 'admission-setup', label: 'إعداد التقديم', icon: <ClipboardCheck size={18} />, to: ROUTES.admin.admissionSetup.index },
    ],
  },
  {
    label: 'البيانات المرجعية والإعدادات',
    items: [
      { key: 'reference-data', label: 'البيانات المرجعية', icon: <Database size={18} />,           to: ROUTES.admin.referenceDataRoot },
      { key: 'admission-rules', label: 'شروط القبول',      icon: <SlidersHorizontal size={18} />,  to: ROUTES.admin.admissionRules },
      { key: 'workflows',       label: 'سير العمل',          icon: <Workflow size={18} />,            to: ROUTES.admin.workflows },
      { key: 'notifications',   label: 'الإشعارات',          icon: <Bell size={18} />,                to: ROUTES.admin.notifications },
      { key: 'payments',        label: 'المدفوعات',           icon: <Banknote size={18} />,            to: ROUTES.admin.payments },
      { key: 'settings',        label: 'الإعدادات العامة',  icon: <Settings size={18} />,           to: ROUTES.admin.settings },
    ],
  },
  {
    label: 'التقارير',
    items: [
      { key: 'reports', label: 'التقارير', icon: <BarChart3 size={18} />, to: ROUTES.admin.reports },
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
