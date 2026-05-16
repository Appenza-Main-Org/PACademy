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
  FileSpreadsheet,
  Grid3x3,
  Settings,
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
 * artifact — the cycle opens the window, admission-setup configures it, then
 * committees staff the review. Committee identity/membership is authored in
 * the `committees` lookup (الأكواد المرجعية → اللجان); the sidebar entry kept
 * here is the per-cycle scheduling surface. Both admin-shell roles
 * (super_admin, committee_admin) carry `admission-setup:read` (see rbac.ts),
 * so gating the whole section by that permission is safe.
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
      { key: 'applicants', label: 'المتقدمون', icon: <ClipboardList size={18} />, to: ROUTES.admin.applicants },
      { key: 'reports',    label: 'التقارير',   icon: <BarChart3 size={18} />,     to: ROUTES.admin.reports },
    ],
  },
  /* ── 2. Per-cycle configuration ──────────────────────────────────────────
   * Order matches the authoring chain: cycles open the window →
   * admission-setup configures it → committees staff the review (only the
   * per-cycle scheduling surface lives here; committee identity/membership
   * is authored in the `committees` lookup). Gate is preserved from the
   * previous "التقديم" section. */
  {
    label: 'التقديم والدورات',
    permission: 'admission-setup:read',
    items: [
      { key: 'cycles',             label: 'الدورات',         icon: <CalendarDays size={18} />,   to: ROUTES.admin.cycles },
      { key: 'admission-setup',    label: 'إعداد التقديم',   icon: <ClipboardCheck size={18} />, to: ROUTES.admin.admissionSetup.index, end: true },
      { key: 'applicant-grades',   label: 'إدارة المجموع والدرجات', icon: <FileSpreadsheet size={18} />, to: ROUTES.admin.applicantGrades },
      { key: 'committee-schedule', label: 'الجدول الزمني',   icon: <Calendar size={18} />,       to: ROUTES.committee.schedule },
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
