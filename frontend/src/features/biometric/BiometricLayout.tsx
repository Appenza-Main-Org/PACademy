import { Outlet } from 'react-router-dom';
import { Activity, DoorOpen, History, ShieldCheck, UserPlus, Search, Users } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'العمليات',
    items: [
      { key: 'lookup',     label: 'استعلام متقدم', icon: <Search size={18} />, to: ROUTES.biometric.overview, end: true },
      { key: 'verify',     label: 'التحقق من الهوية', icon: <ShieldCheck size={18} />, to: ROUTES.biometric.verify },
      { key: 'gate',       label: 'بوابة الدخول والخروج', icon: <DoorOpen size={18} />, to: ROUTES.biometric.gate },
      { key: 'roleInquiry', label: 'استعلام حسب الدور', icon: <Users size={18} />, to: ROUTES.biometric.roleInquiry },
    ],
  },
  {
    label: 'الإدارة والسجلات',
    items: [
      { key: 'enroll',     label: 'تسجيل البصمة', icon: <UserPlus size={18} />, to: ROUTES.biometric.enroll },
      { key: 'attendance', label: 'الحضور والتواجد', icon: <Users size={18} />, to: ROUTES.biometric.attendance },
      { key: 'monitoring', label: 'المراقبة',     icon: <Activity size={18} />, to: ROUTES.biometric.monitoring },
      { key: 'history',    label: 'سجل التحقق',   icon: <History size={18} />,  to: ROUTES.biometric.history },
    ],
  },
];

export function BiometricLayout(): JSX.Element {
  return (
    <AppShell app="biometric" appLabel="البيومتري · 2.6" sidebar={SIDEBAR}>
      <Outlet />
    </AppShell>
  );
}
