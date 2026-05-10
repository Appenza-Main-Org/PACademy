import { Outlet } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  Bell,
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
import { ADMISSION_SETUP_STEPS } from './admission-setup';

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
   * التقديم — collapsible section driven by `ADMISSION_SETUP_STEPS`.
   * Hidden entirely if the user lacks `admission-setup:read`. Auto-expands
   * when on any `/admin/admission-setup/*` route. The 15 child links are
   * sourced from the config so adding a 16th step is config-only here too.
   */
  {
    label: 'التقديم',
    icon: <ClipboardCheck size={14} strokeWidth={1.75} />,
    collapsible: true,
    permission: 'admission-setup:read',
    groupKey: 'admission-setup',
    defaultExpanded: false,
    expandWhenPathStartsWith: '/admin/admission-setup',
    items: [
      {
        key: 'admission-setup-index',
        label: 'لوحة الإعدادات',
        icon: <ClipboardCheck size={18} />,
        to: ROUTES.admin.admissionSetup.index,
        end: true,
      },
      ...[...ADMISSION_SETUP_STEPS]
        .sort((a, b) => a.order - b.order)
        .map((step) => {
          const Icon = step.icon;
          return {
            key: `admission-setup-${step.key}`,
            label: step.labelAr,
            icon: <Icon size={18} />,
            to: `/admin/admission-setup/${step.routeSegment}`,
          };
        }),
    ],
  },
  {
    label: 'البيانات المرجعية والإعدادات',
    items: [
      { key: 'reference-data', label: 'البيانات المرجعية', icon: <Database size={18} />,           to: ROUTES.admin.referenceDataRoot },
      { key: 'admission-rules', label: 'شروط القبول',      icon: <SlidersHorizontal size={18} />,  to: ROUTES.admin.admissionRules },
      { key: 'categories',      label: 'فئات التقديم',      icon: <Layers size={18} />,             to: ROUTES.admin.categories },
      { key: 'cycles',          label: 'الدورات',           icon: <CalendarDays size={18} />,        to: ROUTES.admin.cycles },
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
