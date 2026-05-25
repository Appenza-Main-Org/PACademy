import { Outlet } from 'react-router-dom';
import { Activity, History, ScanFace, ShieldCheck, UserPlus } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'العمليات',
    items: [
      { key: 'overview',   label: 'تحقق فوري',   icon: <ScanFace size={18} />,    to: ROUTES.biometric.overview, end: true },
      { key: 'verify-ops', label: 'بوابة التحقق', icon: <ShieldCheck size={18} />, to: ROUTES.biometric.verifyOps },
    ],
  },
  {
    label: 'الإدارة والسجلات',
    items: [
      { key: 'enroll',     label: 'تسجيل البصمة', icon: <UserPlus size={18} />, to: ROUTES.biometric.enroll },
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
