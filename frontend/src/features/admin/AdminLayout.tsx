import { Outlet } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Database,
  Grid3x3,
  Layers,
  LayoutDashboard,
  Settings,
  Shield,
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
      { key: 'admission-setup', label: 'إعداد التقديم', icon: <ClipboardCheck size={18} />, to: ROUTES.admin.admissionSetup.index },
    ],
  },
  /**
   * لجان القبول — admin-side entry into the committees surface. Mirrors the
   * committee app's own sidebar so super_admin / committee_admin can jump
   * to any of the three committee views without leaving /admin chrome.
   * AuthGuard lets both roles through (they hold the `committee` app key).
   */
  {
    label: 'لجان القبول',
    items: [
      { key: 'committee-overview', label: 'نظرة عامة',    icon: <LayoutDashboard size={18} />, to: ROUTES.committee.overview, end: true },
      { key: 'committee-list',     label: 'قائمة اللجان', icon: <Users size={18} />,           to: ROUTES.committee.list },
      { key: 'committee-schedule', label: 'الجدول الزمني', icon: <Calendar size={18} />,        to: ROUTES.committee.schedule },
    ],
  },
  {
    label: 'البيانات المرجعية والإعدادات',
    items: [
      { key: 'reference-data', label: 'البيانات المرجعية', icon: <Database size={18} />,           to: ROUTES.admin.adminLookups },
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
