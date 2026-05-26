import { Outlet } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Gavel,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

/**
 * Admin sidebar — four explicit sections. Order reflects access frequency,
 * not authoring chain:
 *
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
  /* ── 1. Daily operations ─────────────────────────────────────────────── */
  {
    label: 'العمليات',
    items: [
      { key: 'dashboard',  label: 'لوحة التحكم', icon: <LayoutDashboard size={18} />, to: ROUTES.admin.dashboard, permission: 'reports:view' },
      { key: 'reports',    label: 'التقارير',   icon: <BarChart3 size={18} />,     to: ROUTES.admin.reports, permission: 'reports:view' },
      { key: 'applicants', label: 'المتقدمون', icon: <ClipboardList size={18} />, to: ROUTES.admin.applicants, permission: 'applicants:view' },
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
      { key: 'cycles',             label: 'دورات القبول وإعداد التقديم', icon: <CalendarDays size={18} />,   to: ROUTES.admin.cycles, permission: 'cycles:view' },
      { key: 'committees',         label: 'إدارة مواعيد الاختبارات واللجان', icon: <Gavel size={18} />,          to: ROUTES.admin.committeesExamConfig, permission: 'committees-exam-config:view' },
      { key: 'applicant-grades',   label: 'درجات الثانوية العامة والأزهرية', icon: <FileSpreadsheet size={18} />, to: ROUTES.admin.applicantGrades, permission: 'applicant-grades:view' },
    ],
  },
  /* ── 3. Cross-cycle reference data ─────────────────────────────────── */
  {
    label: 'البيانات المرجعية والإعدادات',
    items: [
      { key: 'lookups',       label: 'الأكواد المرجعية', icon: <Database size={18} />,  to: ROUTES.admin.adminLookupsType('applicant-categories'), permission: 'lookups:view' },
      { key: 'notifications', label: 'الإشعارات',         icon: <Bell size={18} />,      to: ROUTES.admin.notifications, permission: 'notifications:view' },
      { key: 'payments',      label: 'المدفوعات',          icon: <Banknote size={18} />,  to: ROUTES.admin.payments, permission: 'payments:review' },
      { key: 'settings',      label: 'الإعدادات العامة',   icon: <Settings size={18} />,  to: ROUTES.admin.settings, permission: 'settings:view' },
    ],
  },
  /* ── 4. Governance ───────────────────────────────────────────────────── */
  {
    label: 'الأمان والمستخدمون',
    items: [
      { key: 'users', label: 'مستخدمو المنظومة',  icon: <Users size={18} />,  to: ROUTES.admin.users, permission: 'users:view' },
      { key: 'roles', label: 'الأدوار والصلاحيات', icon: <Shield size={18} />, to: ROUTES.admin.roles, permission: 'roles:manage' },
      { key: 'audit', label: 'سجل النشاط',         icon: <Shield size={18} />, to: ROUTES.admin.audit, permission: 'audit:view' },
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
