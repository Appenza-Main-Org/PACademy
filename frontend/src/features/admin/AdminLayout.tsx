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
  Settings2,
  Shield,
  Users,
  Workflow,
} from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

/**
 * Admin sidebar — four explicit sections (plus a header-less hub link at the
 * top). Order reflects access frequency, not authoring chain:
 *
 *   ── (hub)                          back-nav to all apps
 *   1. العمليات                       daily landing surfaces
 *   2. التقديم والدورات                per-cycle configuration + committees
 *   3. البيانات المرجعية والإعدادات    cross-cycle reference data
 *   4. الأمان والمستخدمون              governance (users · roles · audit)
 *
 * Why committees live under "التقديم والدورات": each committee is a per-cycle
 * artifact — categories define WHO can apply, the cycle opens the window,
 * admission-setup configures it, then committees staff the review. Both
 * admin-shell roles (super_admin, committee_admin) carry `admission-setup:read`
 * (see rbac.ts), so gating the whole section by that permission is safe.
 *
 * `إعدادات التقديم` is a deep link into the wizard's first step. The wizard
 * auto-resolves a cycle (active → most-recent → null) so the deep link is safe
 * even when no cycle is selected. `إعداد التقديم` carries `end: true` so the
 * dashboard-style umbrella row doesn't co-highlight with the deep link.
 */
const SIDEBAR: SidebarSection[] = [
  {
    /* Header-less top entry — visually separated by Sidebar's first-section
     * spacing. Hub is a back-nav, not part of any thematic group. */
    items: [
      { key: 'hub', label: 'كل التطبيقات', icon: <Grid3x3 size={18} />, to: ROUTES.hub },
    ],
  },
  /* ── 1. Daily operations ─────────────────────────────────────────────── */
  {
    label: 'العمليات',
    items: [
      { key: 'dashboard',  label: 'لوحة التحكم', icon: <LayoutDashboard size={18} />, to: ROUTES.admin.dashboard, end: true },
      { key: 'applicants', label: 'المتقدمون',    icon: <ClipboardList size={18} />,   to: ROUTES.admin.applicants },
      { key: 'reports',    label: 'التقارير',     icon: <BarChart3 size={18} />,       to: ROUTES.admin.reports },
    ],
  },
  /* ── 2. Per-cycle configuration ──────────────────────────────────────────
   * Order matches the authoring chain: categories define who can apply →
   * cycles open the window → admission-setup configures it → the
   * most-edited step (application_settings) gets a dedicated deep link →
   * committees staff the review. Gate is preserved from the previous
   * "التقديم" section; committee items piggyback on it (both eligible
   * roles carry `admission-setup:read`). */
  {
    label: 'التقديم والدورات',
    permission: 'admission-setup:read',
    items: [
      { key: 'categories',          label: 'فئات التقديم',         icon: <Layers size={18} />,          to: ROUTES.admin.categories },
      { key: 'cycles',              label: 'الدورات',               icon: <CalendarDays size={18} />,    to: ROUTES.admin.cycles },
      { key: 'admission-setup',     label: 'إعداد التقديم',         icon: <ClipboardCheck size={18} />,  to: ROUTES.admin.admissionSetup.index, end: true },
      { key: 'application-settings', label: 'إعدادات التقديم',      icon: <Settings2 size={18} />,       to: ROUTES.admin.admissionSetup.wizard('application_settings') },
      { key: 'committee-overview',  label: 'نظرة عامة على اللجان',  icon: <LayoutDashboard size={18} />, to: ROUTES.committee.overview, end: true },
      { key: 'committee-list',      label: 'قائمة اللجان',          icon: <Users size={18} />,           to: ROUTES.committee.list },
      { key: 'committee-schedule',  label: 'الجدول الزمني',         icon: <Calendar size={18} />,        to: ROUTES.committee.schedule },
    ],
  },
  /* ── 3. Cross-cycle reference data ─────────────────────────────────── */
  {
    label: 'البيانات المرجعية والإعدادات',
    items: [
      { key: 'lookups',       label: 'الأكواد المرجعية', icon: <Database size={18} />,  to: ROUTES.admin.adminLookups },
      { key: 'workflows',     label: 'سير العمل',         icon: <Workflow size={18} />,  to: ROUTES.admin.workflows },
      { key: 'notifications', label: 'الإشعارات',         icon: <Bell size={18} />,      to: ROUTES.admin.notifications },
      { key: 'payments',      label: 'المدفوعات',          icon: <Banknote size={18} />,  to: ROUTES.admin.payments },
      { key: 'settings',      label: 'الإعدادات العامة',   icon: <Settings size={18} />,  to: ROUTES.admin.settings },
    ],
  },
  /* ── 4. Governance ───────────────────────────────────────────────────── */
  {
    label: 'الأمان والمستخدمون',
    items: [
      { key: 'users', label: 'مستخدمو المنظومة',  icon: <Users size={18} />,  to: ROUTES.admin.users },
      { key: 'roles', label: 'الأدوار والصلاحيات', icon: <Shield size={18} />, to: ROUTES.admin.roles },
      { key: 'audit', label: 'سجل النشاط',         icon: <Shield size={18} />, to: ROUTES.admin.audit },
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
